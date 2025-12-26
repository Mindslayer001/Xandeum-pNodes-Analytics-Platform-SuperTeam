/**
 * Quick test to verify error logs are being stored in the database
 */

import db from '@/lib/db';

async function testErrorLogs() {
    console.log('📊 Fetching recent error logs...\n');

    // Fetch last 10 errors
    const recentErrors = await db.errorLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10
    });

    console.log(`Found ${recentErrors.length} recent errors:\n`);

    recentErrors.forEach((err, idx) => {
        console.log(`${idx + 1}. [${err.source}/${err.phase}]`);
        console.log(`   Node: ${err.nodeId || 'N/A'}`);
        console.log(`   Error: ${err.error}`);
        console.log(`   Time: ${err.timestamp.toISOString()}`);
        console.log('');
    });

    // Get stats by source and phase
    console.log('📈 Error Statistics:\n');

    const stats = await db.errorLog.groupBy({
        by: ['source', 'phase'],
        _count: true,
        orderBy: {
            _count: {
                timestamp: 'desc'
            }
        }
    });

    stats.forEach(stat => {
        console.log(`${stat.source} / ${stat.phase}: ${stat._count} errors`);
    });

    await db.$disconnect();
}

testErrorLogs().catch(console.error);
