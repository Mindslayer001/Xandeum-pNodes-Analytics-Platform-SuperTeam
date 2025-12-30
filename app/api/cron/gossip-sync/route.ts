import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { extractIp, ipToRpcUrl, rpcCall, getCredits, resolveGeoLocation } from '@/lib/xandeum-client';
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

/**
 * Get active public nodes from database to use as RPC endpoints
 */
async function getActiveRpcNodes(): Promise<string[]> {
    try {
        const activeNodes = await db.node.findMany({
            where: {
                status: 'active',
                isPublic: true
            },
            select: {
                ip: true
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: 20 // Get top 20 most recently active nodes
        });

        // Convert IP to full RPC URL (add port)
        return activeNodes.map(n => `http://${n.ip}:6000/rpc`);
    } catch (dbError: any) {
        console.warn("⚠️ Failed to fetch active nodes from database:", dbError.message);
        console.warn("Will use fallback nodes instead");
        return []; // Return empty array to trigger fallback
    }
}

/**
 * Fetch gossip data with fallback mechanism
 * Tries active public nodes one by one until we get a good response
 */
async function fetchGossipDataWithFallback(): Promise<any[]> {
    // Use ONLY these 4 curated reliable nodes (no database lookup)
    const RPC_NODES = [
        'http://216.234.134.5:6000/rpc',       // Primary
        'http://173.212.207.32:6000/rpc',      // Fallback 1
        'http://161.97.185.116:6000/rpc',      // Fallback 2
        'http://152.53.236.91:6000/rpc'        // Fallback 3
    ];

    const rpcNodes = RPC_NODES;

    console.log(`🔍 Trying ${rpcNodes.length} curated RPC nodes for gossip data...`);

    const errors: string[] = [];

    // Try nodes in order (primary first, then fallbacks)
    const nodesToTry = rpcNodes;

    for (const node of nodesToTry) {
        try {
            console.log(`  Trying RPC node: ${node}`);
            const result = await rpcCall(node, "get-pods-with-stats");

            // Check for valid response
            if (result && Array.isArray(result.pods)) {
                console.log(`✅ Got ${result.pods.length} pods from ${node}`);
                return result.pods;
            } else if (result && Array.isArray(result.list)) {
                console.log(`✅ Got ${result.list.length} pods from ${node}`);
                return result.list;
            } else if (Array.isArray(result)) {
                console.log(`✅ Got ${result.length} pods from ${node}`);
                return result;
            } else {
                console.warn(`  Invalid response from ${node}:`, JSON.stringify(result).slice(0, 100));
                errors.push(`${node}: Invalid response structure`);
            }
        } catch (e: any) {
            console.warn(`  Failed to get data from ${node}:`, e.message);
            errors.push(`${node}: ${e.message}`);
            // Continue to next node
        }
    }

    // All nodes failed
    console.error("❌ All RPC nodes failed:", errors);
    throw new Error(`All ${rpcNodes.length} RPC nodes failed. Errors: ${errors.join('; ')}`);
}

export async function POST() {
    const startTime = Date.now();
    const errors: Array<{ node: string; error: string; phase: string }> = [];
    let nodesProcessed = 0;
    let nodesUpserted = 0;
    let snapshotsCreated = 0;

    try {
        console.log("🌐 Gossip Sync Triggered");

        // Step 1: Fetch gossip data with fallback mechanism
        let rawPods: any[] = [];
        try {
            rawPods = await fetchGossipDataWithFallback();
        } catch (fetchError: any) {
            console.error("❌ Failed to fetch gossip data:", fetchError);

            await logErrorToDb(
                'cron/gossip-sync',
                'fetch',
                fetchError.message,
                undefined,
                fetchError.stack
            );

            return NextResponse.json({
                success: false,
                error: "Failed to fetch gossip data from any RPC node",
                details: fetchError.message,
                phase: "fetch"
            }, { status: 500 });
        }

        if (!rawPods || rawPods.length === 0) {
            console.warn("⚠️ No pods found in gossip network");
            return NextResponse.json({
                success: false,
                error: "No pods found in gossip network",
                nodesProcessed: 0,
                errors: []
            }, { status: 200 });
        }

        console.log(`📦 Processing ${rawPods.length} nodes from gossip network`);

        // Step 2: Fetch credits for all nodes
        const creditsMap = await getCredits();

        // Step 3: Pre-process all nodes and fetch GeoIP data OUTSIDE transaction
        // This avoids slow external API calls inside the transaction
        console.log("🔍 Pre-fetching GeoIP data for all nodes...");

        type ProcessedNode = {
            ip: string;
            pubkey: string | null;
            version: string;
            credits: number;
            storage: number;
            uptime: number;
            status: string;
            geo: { country: string; lat: number; lon: number };
        };

        const processedNodes: ProcessedNode[] = [];

        for (const pod of rawPods) {
            try {
                // Extract IP without port - only the IP address will be stored
                let address = pod.address || pod.addr || (pod.ip ? pod.ip : "");
                const ip = extractIp(address || pod.ip || "");

                if (!ip || ip === "0.0.0.0") {
                    const errorMsg = `Missing or invalid IP address: ${ip}`;
                    errors.push({
                        node: 'unknown',
                        error: errorMsg,
                        phase: 'validation'
                    });
                    continue;
                }

                const pubkey = pod.pubkey || pod.node_pubkey || null;
                const uptime = pod.uptime || 0;
                const status = 'active'; // Node is active because it's in the gossip network

                // Get geo location (cached) - this is the slow part
                const geo = await resolveGeoLocation(ip);

                const storage = typeof pod.storage === 'string' ? parseFloat(pod.storage) : (pod.storage || 0);
                const credits = creditsMap[pubkey] || 0;

                processedNodes.push({
                    ip,
                    pubkey,
                    version: pod.version,
                    credits,
                    storage,
                    uptime,
                    status,
                    geo
                });

                nodesProcessed++;

                // Log progress every 50 nodes
                if (nodesProcessed % 50 === 0) {
                    console.log(`  Processed: ${nodesProcessed}/${rawPods.length} nodes`);
                }

            } catch (nodeError: any) {
                const nodeId = pod.ip || pod.address || 'unknown';
                console.error(`  ❌ Failed to process node ${nodeId}:`, nodeError.message);
                errors.push({
                    node: nodeId,
                    error: nodeError.message,
                    phase: 'preprocessing'
                });
            }
        }

        console.log(`✅ Pre-processed ${processedNodes.length} nodes`);

        // Step 4: Use transaction for atomic database updates (fast operations only)
        try {
            await db.$transaction(async (tx) => {
                console.log("🔄 Starting database transaction...");

                // Step 4a: Mark ALL nodes as inactive
                const updateResult = await tx.node.updateMany({
                    data: { status: 'inactive' }
                });
                console.log(`  ✅ Marked ${updateResult.count} nodes as inactive`);

                // Step 4b: Upsert all processed nodes (fast database operations only)
                const snapshots: any[] = [];
                const gossipIps = new Set<string>();

                for (const node of processedNodes) {
                    try {
                        gossipIps.add(node.ip);

                        // Upsert node - insert new or update existing
                        await tx.node.upsert({
                            where: { ip: node.ip }, // IP without port
                            update: {
                                pubkey: node.pubkey,
                                version: node.version,
                                country: node.geo.country,
                                lat: node.geo.lat,
                                lon: node.geo.lon,
                                credits: node.credits,
                                storage: node.storage,
                                uptime: node.uptime,
                                status: node.status, // Mark as active
                                updatedAt: new Date()
                                // Note: Don't update CPU, RAM, packets etc - those are updated by stats-updater
                            },
                            create: {
                                ip: node.ip, // IP without port
                                pubkey: node.pubkey,
                                version: node.version,
                                country: node.geo.country,
                                lat: node.geo.lat,
                                lon: node.geo.lon,
                                credits: node.credits,
                                storage: node.storage,
                                uptime: node.uptime,
                                status: node.status,
                                cpuPercent: 0,
                                ramUsage: 0,
                                ramUsed: 0,
                                ramTotal: 0,
                                activeStreams: 0,
                                packetsReceived: 0,
                                packetsSent: 0,
                                isPublic: true
                            }
                        });

                        nodesUpserted++;

                        // Create snapshot for historical tracking
                        snapshots.push({
                            nodeIp: node.ip, // IP without port
                            credits: node.credits,
                            storage: node.storage,
                            uptime: node.uptime,
                            status: node.status,
                            cpuPercent: 0, // Will be updated by stats-updater
                            ramUsage: 0,
                            ramUsed: 0,
                            ramTotal: 0,
                            activeStreams: 0,
                            packetsReceived: 0,
                            packetsSent: 0,
                            timestamp: new Date()
                        });

                    } catch (nodeError: any) {
                        console.error(`  ❌ Failed to upsert node ${node.ip}:`, nodeError.message);
                        errors.push({
                            node: node.ip,
                            error: nodeError.message,
                            phase: 'upsert'
                        });
                        // Continue processing other nodes
                    }
                }

                if (snapshots.length > 0) {
                    const snapshotResult = await tx.nodeSnapshot.createMany({
                        data: snapshots
                    });
                    snapshotsCreated = snapshotResult.count;
                    console.log(`  ✅ Created ${snapshotsCreated} snapshots`);
                }

                // Step 4d: Create NetworkStats summary record for this gossip sync
                // This gives us a historical record of the network state at each sync
                const totalStorage = processedNodes.reduce((sum, node) => sum + node.storage, 0);
                const totalCredits = processedNodes.reduce((sum, node) => sum + node.credits, 0);
                const activeCount = processedNodes.filter(n => n.status === 'active').length;
                const inactiveCount = await tx.node.count({ where: { status: 'inactive' } });

                await tx.networkStats.create({
                    data: {
                        activeNodes: activeCount,
                        inactiveNodes: inactiveCount,
                        totalStorage: totalStorage,
                        totalCredits: BigInt(totalCredits),
                        timestamp: new Date()
                    }
                });
                console.log(`  ✅ Created NetworkStats summary (Active: ${activeCount}, Inactive: ${inactiveCount})`);

                console.log(`  ✅ Upserted ${nodesUpserted} nodes (${gossipIps.size} unique IPs)`);
            }, {
                timeout: 30000 // 30 second timeout for transaction (should be plenty now)
            });

            console.log("✅ Transaction committed successfully");

            // Refresh caches
            try {
                await Promise.all([
                    refreshNetworkStatsCache(),
                    refreshNodesCache()
                ]);
            } catch (cacheError) {
                console.error("⚠️ Failed to refresh caches:", cacheError);
                // Don't fail the request, just log
            }

        } catch (txError: any) {
            console.error("❌ Transaction failed:", txError);

            await logErrorToDb(
                'cron/gossip-sync',
                'transaction',
                txError.message,
                undefined,
                txError.stack
            );

            return NextResponse.json({
                success: false,
                error: "Database transaction failed",
                details: txError.message,
                phase: "transaction",
                nodesProcessed,
                errors
            }, { status: 500 });
        }

        console.log(`✅ Successfully synced ${nodesUpserted}/${rawPods.length} nodes from gossip`);

        const duration = Date.now() - startTime;
        const result = {
            success: true,
            nodesProcessed,
            nodesUpserted,
            snapshotsCreated,
            totalNodes: rawPods.length,
            errors: errors.length > 0 ? errors : undefined,
            durationMs: duration,
            message: `Gossip sync completed: ${nodesUpserted}/${rawPods.length} nodes synced, ${snapshotsCreated} snapshots created${errors.length > 0 ? `, ${errors.length} errors` : ''}`
        };

        console.log(`✅ ${result.message} (${duration}ms)`);
        return NextResponse.json(result);

    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error("❌ Gossip sync critical failure:", error);

        await logErrorToDb(
            'cron/gossip-sync',
            'critical',
            error.message,
            undefined,
            error.stack
        );

        return NextResponse.json({
            success: false,
            error: "Critical failure in gossip sync",
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            nodesProcessed,
            nodesUpserted,
            snapshotsCreated,
            errors,
            durationMs: duration
        }, { status: 500 });
    }
}
