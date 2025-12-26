
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const ip = params.id;

        // Validate IP somewhat? 
        if (!ip) {
            return NextResponse.json({ success: false, error: "Node IP required" }, { status: 400 });
        }

        const node = await db.node.findUnique({
            where: { ip: ip }
        });

        if (!node) {
            return NextResponse.json({ success: false, error: "Node not found" }, { status: 404 });
        }

        // Get snapshots (history) for the node (e.g., last 24h)
        const snapshots = await db.nodeSnapshot.findMany({
            where: {
                nodeIp: ip,
                timestamp: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24h
                }
            },
            orderBy: {
                timestamp: 'asc'
            }
        });

        // Serialize BigInts
        const serializedNode = {
            ...node,
            packetsReceived: node.packetsReceived.toString(),
            packetsSent: node.packetsSent.toString()
        };

        const serializedSnapshots = snapshots.map(s => ({
            ...s,
            packetsReceived: s.packetsReceived.toString(),
            packetsSent: s.packetsSent.toString()
        }));

        return NextResponse.json({
            success: true,
            node: serializedNode,
            history: serializedSnapshots
        });

    } catch (error: any) {
        console.error(`Failed to fetch node details for ${params.id}:`, error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
