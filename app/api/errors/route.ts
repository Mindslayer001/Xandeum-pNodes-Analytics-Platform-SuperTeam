import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '100');
        const source = searchParams.get('source'); // Filter by source
        const phase = searchParams.get('phase'); // Filter by phase

        const where: any = {};
        if (source) where.source = source;
        if (phase) where.phase = phase;

        const errorLogs = await db.errorLog.findMany({
            where,
            orderBy: {
                timestamp: 'desc'
            },
            take: limit
        });

        const stats = await db.errorLog.groupBy({
            by: ['source', 'phase'],
            _count: true,
            where
        });

        return NextResponse.json({
            success: true,
            count: errorLogs.length,
            errors: errorLogs,
            stats: stats.map(s => ({
                source: s.source,
                phase: s.phase,
                count: s._count
            }))
        });
    } catch (error: any) {
        console.error("Failed to fetch error logs:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
