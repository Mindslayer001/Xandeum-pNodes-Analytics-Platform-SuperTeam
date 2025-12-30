
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getNodesList } from '@/lib/nodes-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Parse query parameters
        // Fetch full nodes list (cached)
        const cachedData = await getNodesList();

        // If client requests pagination on the cached list:
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '1000');

        const validPage = Math.max(1, page);
        const validLimit = Math.min(Math.max(1, limit), 2000);
        const skip = (validPage - 1) * validLimit;

        // Slice the cached nodes array
        const nodes = cachedData.nodes.slice(skip, skip + validLimit);

        // Return cached stats and paginated nodes
        const totalNodes = cachedData.stats.totalNodes;
        const totalPages = Math.ceil(totalNodes / validLimit);

        return NextResponse.json({
            nodes,
            stats: cachedData.stats,
            pagination: {
                page: validPage,
                limit: validLimit,
                totalPages,
                totalItems: totalNodes,
                hasNextPage: validPage < totalPages,
                hasPreviousPage: validPage > 1,
                cachedAt: cachedData.timestamp
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
