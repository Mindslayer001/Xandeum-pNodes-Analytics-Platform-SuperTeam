

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getPodsWithStats, extractIp, XandeumNode } from '@/lib/xandeum-client';

export const dynamic = 'force-dynamic'; // Ensure not cached by Next.js

// Helper function to log errors to database
async function logErrorToDb(source: string, phase: string, error: string, nodeId?: string, details?: string) {
    try {
        await db.errorLog.create({
            data: {
                source,
                phase,
                nodeId: nodeId || null,
                error,
                details: details || null
            }
        });
    } catch (dbError: any) {
        // If we can't log to DB, at least log to console
        console.error("Failed to log error to database:", dbError.message);
    }
}


export async function POST() {
    const startTime = Date.now();
    const errors: Array<{ node: string; error: string; phase: string }> = [];
    let nodesProcessed = 0;
    let snapshotsCreated = 0;

    try {
        console.log("🚀 Assembler Worker Triggered");

        // 1. Fetch Enriched Gossip Nodes with error handling
        let enrichedNodes: XandeumNode[] = [];
        try {
            enrichedNodes = await getPodsWithStats();
            console.log(`✅ Fetched ${enrichedNodes?.length || 0} nodes from RPC`);
        } catch (fetchError: any) {
            console.error("❌ Failed to fetch nodes from RPC:", fetchError);
            // Log to database
            await logErrorToDb(
                'cron/assembler',
                'fetch',
                fetchError.message,
                undefined,
                fetchError.stack
            );
            return NextResponse.json({
                success: false,
                error: "Failed to fetch nodes from RPC",
                details: fetchError.message,
                phase: "fetch"
            }, { status: 500 });
        }

        if (!enrichedNodes || enrichedNodes.length === 0) {
            console.warn("⚠️ No pods found via RPC");
            return NextResponse.json({
                success: false,
                error: "No pods found via RPC. Check server logs for connection errors.",
                nodesProcessed: 0,
                errors: []
            }, { status: 200 }); // Return 200 for cron, but with error message
        }

        // 2. Process nodes individually with error isolation
        // Using chunked processing to avoid transaction timeouts
        const CHUNK_SIZE = 50; // Process 50 nodes at a time
        const chunks = [];
        for (let i = 0; i < enrichedNodes.length; i += CHUNK_SIZE) {
            chunks.push(enrichedNodes.slice(i, i + CHUNK_SIZE));
        }

        console.log(`📦 Processing ${enrichedNodes.length} nodes in ${chunks.length} chunks`);

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} nodes)`);

            // Process each node in the chunk individually
            for (const node of chunk) {
                try {
                    // Extract IP without port for database storage
                    let address = node.address || node.addr || node.ip || "";
                    const finalIp = extractIp(address);

                    if (!finalIp) {
                        const errorMsg = 'Missing IP address';
                        errors.push({
                            node: 'unknown',
                            error: errorMsg,
                            phase: 'validation'
                        });
                        // Log to database (fire and forget)
                        logErrorToDb('cron/assembler', 'validation', errorMsg).catch(() => { });
                        continue;
                    }

                    const pubkey = node.pubkey || node.node_pubkey || null;
                    const status = node.status || "unknown";
                    const storage = typeof node.storage === 'string' ? parseFloat(node.storage) : (node.storage || 0);

                    // Upsert node with individual error handling
                    await db.node.upsert({
                        where: { ip: finalIp },
                        update: {
                            pubkey: pubkey,
                            version: node.version,
                            country: node.country,
                            lat: node.lat,
                            lon: node.lon,
                            credits: node.credits,
                            storage: storage,
                            uptime: node.uptime,
                            status: status,
                            cpuPercent: node.cpuPercent || 0,
                            ramUsage: node.ramUsage || 0,
                            ramUsed: node.ramUsed || 0,
                            ramTotal: node.ramTotal || 0,
                            activeStreams: node.activeStreams || 0,
                            packetsReceived: node.packetsReceived || 0,
                            packetsSent: node.packetsSent || 0,
                            updatedAt: new Date()
                        },
                        create: {
                            ip: finalIp,
                            pubkey: pubkey,
                            version: node.version,
                            country: node.country,
                            lat: node.lat,
                            lon: node.lon,
                            credits: node.credits,
                            storage: storage,
                            uptime: node.uptime,
                            status: status,
                            cpuPercent: node.cpuPercent || 0,
                            ramUsage: node.ramUsage || 0,
                            ramUsed: node.ramUsed || 0,
                            ramTotal: node.ramTotal || 0,
                            activeStreams: node.activeStreams || 0,
                            packetsReceived: node.packetsReceived || 0,
                            packetsSent: node.packetsSent || 0,
                            isPublic: true
                        }
                    });

                    nodesProcessed++;
                } catch (nodeError: any) {
                    const nodeId = node.ip || node.address || 'unknown';
                    console.error(`❌ Failed to upsert node ${nodeId}:`, nodeError.message);
                    errors.push({
                        node: nodeId,
                        error: nodeError.message,
                        phase: 'upsert'
                    });
                    // Log to database (fire and forget)
                    logErrorToDb(
                        'cron/assembler',
                        'upsert',
                        nodeError.message,
                        nodeId,
                        nodeError.stack
                    ).catch(() => { });
                    // Continue processing other nodes
                }
            }
        }

        console.log(`✅ Successfully upserted ${nodesProcessed}/${enrichedNodes.length} nodes`);

        // 3. Create History Snapshots with error handling
        try {
            const snapshots = enrichedNodes
                .filter((node) => {
                    const address = node.address || node.addr || node.ip || "";
                    const finalIp = extractIp(address);
                    return !!finalIp && finalIp !== "0.0.0.0"; // Only include nodes with valid IPs
                })
                .map((node: XandeumNode) => {
                    // Extract IP without port for snapshot storage
                    const address = node.address || node.addr || node.ip || "";
                    const finalIp = extractIp(address);
                    const storage = typeof node.storage === 'string' ? parseFloat(node.storage) : (node.storage || 0);

                    return {
                        nodeIp: finalIp,
                        credits: node.credits,
                        storage: storage,
                        uptime: node.uptime || 0,
                        status: node.status || "unknown",
                        cpuPercent: node.cpuPercent || 0,
                        ramUsage: node.ramUsage || 0,
                        ramUsed: node.ramUsed || 0,
                        ramTotal: node.ramTotal || 0,
                        activeStreams: node.activeStreams || 0,
                        packetsReceived: node.packetsReceived || 0,
                        packetsSent: node.packetsSent || 0,
                        timestamp: new Date()
                    }
                });

            if (snapshots.length > 0) {
                const result = await db.nodeSnapshot.createMany({
                    data: snapshots
                });
                snapshotsCreated = result.count;
                console.log(`✅ Created ${snapshotsCreated} snapshots`);
            }
        } catch (snapshotError: any) {
            console.error("❌ Failed to create snapshots:", snapshotError);
            errors.push({
                node: 'batch',
                error: snapshotError.message,
                phase: 'snapshot'
            });
            // Log to database (fire and forget)
            logErrorToDb(
                'cron/assembler',
                'snapshot',
                snapshotError.message,
                undefined,
                snapshotError.stack
            ).catch(() => { });
            // Don't fail the entire operation if snapshots fail
        }

        const duration = Date.now() - startTime;
        const result = {
            success: true,
            nodesProcessed,
            snapshotsCreated,
            totalNodes: enrichedNodes.length,
            errors: errors.length > 0 ? errors : undefined,
            durationMs: duration,
            message: `Assembler completed: ${nodesProcessed}/${enrichedNodes.length} nodes processed, ${snapshotsCreated} snapshots created${errors.length > 0 ? `, ${errors.length} errors` : ''}`
        };

        console.log(`✅ ${result.message} (${duration}ms)`);

        // Return 200 even with partial failures for cron job
        return NextResponse.json(result);

    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error("❌ Assembler critical failure:", error);

        // Log critical failure to database
        await logErrorToDb(
            'cron/assembler',
            'critical',
            error.message,
            undefined,
            error.stack
        );

        return NextResponse.json({
            success: false,
            error: "Critical failure in assembler",
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            nodesProcessed,
            snapshotsCreated,
            errors,
            durationMs: duration
        }, { status: 500 });
    }
}
