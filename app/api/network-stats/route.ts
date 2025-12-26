import { NextResponse } from 'next/server';
import { getNetworkStats } from '@/lib/network-stats-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || '24h'; // Default to 24h

        const data = await getNetworkStats(range);

        return NextResponse.json({
            success: true,
            data
        });

    } catch (error: any) {
        console.error("Failed to fetch network stats:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
            details: error.stack
        }, { status: 500 });
    }
}
