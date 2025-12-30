import db from '../lib/db';

async function checkData() {
    console.log("Checking Node data...\n");

    // Get distinct status values
    const statusQuery = await db.node.findMany({
        select: { status: true },
        distinct: ['status']
    });
    console.log("Distinct Status Values:", statusQuery.map(n => n.status));

    // Get sample storage values
    const storageQuery = await db.node.findMany({
        select: { storage: true, ip: true },
        take: 10,
        orderBy: { storage: 'desc' }
    });
    console.log("\nTop 10 Storage Values:");
    storageQuery.forEach(n => console.log(`  ${n.ip}: ${n.storage}`));

    // Get count by status
    const allNodes = await db.node.findMany({ select: { status: true } });
    const statusCounts: Record<string, number> = {};
    allNodes.forEach(n => {
        statusCounts[n.status] = (statusCounts[n.status] || 0) + 1;
    });
    console.log("\nStatus Counts:", statusCounts);

    // Check Snapshots
    const snapshotCount = await db.nodeSnapshot.count();
    console.log(`\nTotal Snapshots: ${snapshotCount}`);

    // Check latest update
    const latestNode = await db.node.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true, ip: true }
    });
    console.log(`\nLatest Node Update: ${latestNode?.updatedAt?.toISOString()} (${latestNode?.ip})`);

    const latestSnapshot = await db.nodeSnapshot.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true }
    });
    console.log(`Latest Snapshot: ${latestSnapshot?.timestamp?.toISOString()}`);

    await db.$disconnect();
}

checkData().catch(console.error);
