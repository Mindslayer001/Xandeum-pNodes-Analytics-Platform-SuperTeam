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

    await db.$disconnect();
}

checkData().catch(console.error);
