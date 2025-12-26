
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        // Validate parameters
        const validPage = Math.max(1, page);
        const validLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page
        const skip = (validPage - 1) * validLimit;

        // Get total count for pagination metadata
        const totalNodes = await db.node.count();
        const totalPages = Math.ceil(totalNodes / validLimit);

        // Fetch paginated nodes
        const rawNodes = await db.node.findMany({
            orderBy: { credits: 'desc' },
            skip: skip,
            take: validLimit
        });

        // Convert BigInt to strings for JSON serialization
        const nodes = rawNodes.map(node => ({
            ...node,
            packetsReceived: node.packetsReceived.toString(),
            packetsSent: node.packetsSent.toString()
        }));

        // Calculate Aggregates (from ALL nodes, not just current page)
        const allNodes = await db.node.findMany({
            select: {
                storage: true,
                credits: true,
                status: true,
                uptime: true
            }
        });

        const totalStorage = allNodes.reduce((acc, n) => acc + n.storage, 0);
        const totalCredits = allNodes.reduce((acc, n) => acc + n.credits, 0);
        const activeNodes = allNodes.filter(n => n.status === 'active' || n.status === 'Active').length;
        const avgUptime = allNodes.length > 0 ? allNodes.reduce((acc, n) => acc + n.uptime, 0) / allNodes.length : 0;

        return NextResponse.json({
            nodes,
            stats: {
                totalStorage,
                totalCredits,
                activeNodes,
                totalNodes: allNodes.length,
                avgUptime
            },
            pagination: {
                page: validPage,
                limit: validLimit,
                totalPages,
                totalItems: totalNodes,
                hasNextPage: validPage < totalPages,
                hasPreviousPage: validPage > 1
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
