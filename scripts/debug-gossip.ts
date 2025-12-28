
import db from '../lib/db';
import { extractIp, rpcCall, resolveGeoLocation } from '../lib/xandeum-client';

// Hardcoded reliable nodes
const RPC_NODES = [
    'http://216.234.134.5:6000/rpc',
    'http://173.212.207.32:6000/rpc'
];

async function main() {
    console.log("🚀 Starting Debug Gossip Sync...");

    try {
        // 1. Fetch Gossip
        let rawPods: any[] = [];
        for (const node of RPC_NODES) {
            try {
                console.log(`Trying ${node}...`);
                const result = await rpcCall(node, "get-pods-with-stats");
                if (result && Array.isArray(result.pods)) {
                    rawPods = result.pods;
                    console.log(`✅ Fetched ${rawPods.length} pods from ${node}`);
                    break;
                }
            } catch (e: any) {
                console.error(`Failed ${node}: ${e.message}`);
            }
        }

        if (rawPods.length === 0) {
            console.error("❌ Failed to fetch pods from any node.");
            return;
        }

        // 2. Process Nodes
        console.log("Processing nodes...");
        const validNodes: any[] = [];
        let count = 0;

        for (const pod of rawPods) {
            // Only process first 20 for debug speed
            if (count++ > 20) break;

            let address = pod.address || pod.addr || (pod.ip ? pod.ip : "");
            const ip = extractIp(address || pod.ip || "");

            if (!ip || ip === "0.0.0.0") continue;

            const geo = await resolveGeoLocation(ip);
            console.log(`Processed ${ip} -> ${geo?.country}`);

            validNodes.push({
                ip,
                geo
            });
        }

        console.log(`Prepared ${validNodes.length} nodes for DB update.`);

        // 3. DB Transaction
        console.log("Starting DB Transaction...");
        await db.$transaction(async (tx) => {
            // Update inactive
            await tx.node.updateMany({ data: { status: 'inactive' } });

            // Upsert nodes
            for (const n of validNodes) {
                await tx.node.upsert({
                    where: { ip: n.ip },
                    update: { status: 'active', updatedAt: new Date() },
                    create: {
                        ip: n.ip,
                        status: 'active',
                        country: n.geo?.country,
                        lat: n.geo?.lat,
                        lon: n.geo?.lon,
                        // Defaults
                        credits: 0, storage: 0, uptime: 0
                    }
                });

                // Snapshot
                await tx.nodeSnapshot.create({
                    data: {
                        nodeIp: n.ip,
                        status: 'active',
                        credits: 0, storage: 0, uptime: 0, cpuPercent: 0, ramUsage: 0,
                        timestamp: new Date()
                    }
                });
            }
        });

        console.log("✅ Transaction Committed!");

    } catch (e: any) {
        console.error("❌ Fatal Error:", e);
    } finally {
        await db.$disconnect();
    }
}

main();
