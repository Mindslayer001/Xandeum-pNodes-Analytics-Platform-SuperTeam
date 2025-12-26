
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
    console.log("🔍 Checking Error Logs...");
    const errors = await db.errorLog.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' }
    });
    console.log("Recent Errors:", errors);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await db.$disconnect());
