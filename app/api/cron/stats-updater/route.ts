import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getStats } from '@/lib/xandeum-client';
import { refreshNetworkStatsCache } from '@/lib/network-stats-service';
import { refreshNodesCache } from '@/lib/nodes-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

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
        console.error("Failed to log error to database:", dbError.message);
    }
}

export async function POST() {
    const startTime = Date.now();
    const errors: Array<{ node: string; error: string; phase: string }> = [];
    let nodesUpdated = 0;
    let snapshotsCreated = 0;

    // Stats counters
    let activeNodesCount = 0;
    let inactiveNodesCount = 0;
    let totalNetworkStorage = 0;
    let totalNetworkCredits = BigInt(0);

    try {
        console.log("📊 Stats Updater Triggered");

        // Get all active nodes from database to update their stats
        const nodes = await db.node.findMany({
            where: {
                status: 'active'
            },
            select: {
                ip: true,
                pubkey: true,
                credits: true
            }
        });

        if (!nodes || nodes.length === 0) {
            console.warn("⚠️ No nodes found in database");
            return NextResponse.json({
                success: false,
                message: "No nodes found in database"
            });
        }

        console.log(`📦 Updating stats for ${nodes.length} nodes...`);

        const snapshots: any[] = [];

        // BATCH PROCESSING CONFIG
        const BATCH_SIZE = 10; // Process 10 nodes concurrently
        const chunks = [];
        for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
            chunks.push(nodes.slice(i, i + BATCH_SIZE));
        }

        console.log(`🚀 Processing in ${chunks.length} batches of ${BATCH_SIZE}...`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            // Process batch in parallel
            await Promise.all(chunk.map(async (node) => {
                try {
                    // Fetch stats with timeout in client to avoid hanging
                    const stats = await getStats(`${node.ip}:6000`);

                    if (!stats) {
                        // Mark inactive
                        await db.node.update({
                            where: { ip: node.ip },
                            data: { status: 'inactive', updatedAt: new Date() }
                        });
                        inactiveNodesCount++;

                        // Inactive Snapshot
                        snapshots.push({
                            nodeIp: node.ip,
                            credits: node.credits || 0,
                            storage: 0,
                            uptime: 0,
                            status: 'inactive',
                            cpuPercent: 0,
                            ramUsage: 0,
                            ramUsed: 0,
                            ramTotal: 0,
                            activeStreams: 0,
                            packetsReceived: 0,
                            packetsSent: 0,
                            timestamp: new Date()
                        });
                        return;
                    }

                    // Active Node Processing
                    activeNodesCount++;
                    const storageVal = stats.fileSize ? stats.fileSize / (1024 ** 3) : 0; // GB
                    totalNetworkStorage += storageVal;
                    totalNetworkCredits += BigInt(node.credits || 0);

                    // Update DB
                    await db.node.update({
                        where: { ip: node.ip },
                        data: {
                            status: 'active',
                            cpuPercent: stats.cpuPercent || 0,
                            ramUsage: stats.ramPercent || 0,
                            ramUsed: stats.ramUsed || 0,
                            ramTotal: stats.ramTotal || 0,
                            activeStreams: stats.activeStreams || 0,
                            packetsReceived: stats.packetsReceived || 0,
                            packetsSent: stats.packetsSent || 0,
                            uptime: stats.uptime || 0,
                            storage: storageVal,
                            updatedAt: new Date()
                        }
                    });

                    nodesUpdated++;

                    // Active Snapshot
                    snapshots.push({
                        nodeIp: node.ip,
                        credits: node.credits || 0,
                        storage: storageVal,
                        uptime: stats.uptime || 0,
                        status: 'active',
                        cpuPercent: stats.cpuPercent || 0,
                        ramUsage: stats.ramPercent || 0,
                        ramUsed: stats.ramUsed || 0,
                        ramTotal: stats.ramTotal || 0,
                        activeStreams: stats.activeStreams || 0,
                        packetsReceived: stats.packetsReceived || 0,
                        packetsSent: stats.packetsSent || 0,
                        timestamp: new Date()
                    });

                } catch (nodeError: any) {
                    console.error(`❌ Failed to update ${node.ip}:`, nodeError.message);
                    errors.push({ node: node.ip, error: nodeError.message, phase: 'update' });
                    logErrorToDb('cron/stats-updater', 'update', nodeError.message, node.ip).catch(() => { });
                }
            }));

            // Optional: Small delay between batches to breath? 
            // await new Promise(r => setTimeout(r, 100));
        }

        console.log(`✅ Processed all batches. Active: ${activeNodesCount}, Inactive: ${inactiveNodesCount}`);

        // Bulk insert snapshots
        if (snapshots.length > 0) {
            try {
                const result = await db.nodeSnapshot.createMany({ data: snapshots });
                snapshotsCreated = result.count;
            } catch (err: any) {
                console.error("Snapshot error:", err);
            }
        }

        // Network Stats
        try {
            await db.networkStats.create({
                data: {
                    activeNodes: activeNodesCount,
                    inactiveNodes: inactiveNodesCount,
                    totalStorage: totalNetworkStorage,
                    totalCredits: totalNetworkCredits,
                    timestamp: new Date()
                }
            });

            // Refresh Caches
            await Promise.allSettled([
                refreshNetworkStatsCache(),
                refreshNodesCache()
            ]);

        } catch (err: any) {
            console.error("Network stats error:", err);
        }

        const duration = Date.now() - startTime;
        return NextResponse.json({
            success: true,
            nodesUpdated,
            snapshotsCreated,
            durationMs: duration,
            message: `Completed in ${duration}ms`
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
