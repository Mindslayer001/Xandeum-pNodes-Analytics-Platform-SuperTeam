
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
    console.log("🔍 Verifying Network Stats...");
    const stats = await db.networkStats.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' }
    });
    console.log("NetworkStats:", stats);

    console.log("\n🔍 Verifying Node Snapshots (Active vs Inactive)...");
    const activeSnapshots = await db.nodeSnapshot.count({ where: { status: 'active' } });
    const inactiveSnapshots = await db.nodeSnapshot.count({ where: { status: 'inactive' } });
    console.log(`Active Snapshots: ${activeSnapshots}`);
    console.log(`Inactive Snapshots: ${inactiveSnapshots}`);

    // Check if inactive snapshots have 0 storage/credits as expected
    const sampleInactive = await db.nodeSnapshot.findFirst({
        where: { status: 'inactive' }
    });
    console.log("Sample Inactive Snapshot:", sampleInactive);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await db.$disconnect());
