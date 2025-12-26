import db from '../lib/db';

async function verifyIpFormat() {
    console.log("🔍 Verifying IP format in database...\n");

    // Check for any IPs with ports
    const nodesWithPorts = await db.node.findMany({
        where: {
            ip: {
                contains: ':'
            }
        },
        select: { ip: true }
    });

    if (nodesWithPorts.length > 0) {
        console.log(`❌ Found ${nodesWithPorts.length} nodes with ports:`);
        nodesWithPorts.forEach(n => console.log(`  ${n.ip}`));
    } else {
        console.log("✅ All Node IPs are in correct format (no ports)");
    }

    // Sample some IPs
    const sampleNodes = await db.node.findMany({
        select: { ip: true, status: true },
        take: 10
    });

    console.log("\nSample Node IPs:");
    sampleNodes.forEach(n => console.log(`  ${n.ip} (${n.status})`));

    // Check snapshots
    const snapshotsWithPorts = await db.nodeSnapshot.findMany({
        where: {
            nodeIp: {
                contains: ':'
            }
        },
        select: { nodeIp: true },
        distinct: ['nodeIp']
    });

    if (snapshotsWithPorts.length > 0) {
        console.log(`\n❌ Found ${snapshotsWithPorts.length} snapshots with ports in nodeIp`);
    } else {
        console.log("\n✅ All NodeSnapshot nodeIp values are in correct format (no ports)");
    }

    await db.$disconnect();
}

verifyIpFormat().catch(console.error);
