
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
    console.log("🌱 Seeding Network Stats...");

    // Get current counts to be somewhat accurate
    const active = await db.node.count({ where: { status: 'active' } });
    const inactive = await db.node.count({ where: { status: 'inactive' } });

    await db.networkStats.create({
        data: {
            activeNodes: active,
            inactiveNodes: inactive,
            totalStorage: 1024.5, // Dummy value
            totalCredits: 5000000,
            timestamp: new Date()
        }
    });

    console.log("✅ Seeded NetworkStats");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await db.$disconnect());
