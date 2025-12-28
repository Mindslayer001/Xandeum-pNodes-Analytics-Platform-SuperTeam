
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.nodeSnapshot.count();
        console.log(`Total NodeSnapshots: ${count}`);

        if (count > 0) {
            const latest = await prisma.nodeSnapshot.findFirst({
                orderBy: { timestamp: 'desc' }
            });
            console.log('Latest snapshot:', latest);
        } else {
            console.log('No snapshots found. This is why the chart is empty.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
