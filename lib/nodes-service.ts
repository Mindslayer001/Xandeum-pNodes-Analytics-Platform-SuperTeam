import db from '@/lib/db';
import { getCachedNodes, setCachedNodes, clearNodesCache } from './nodes-cache';

/**
 * Fetch the full list of nodes with stats, using cache if available
 */
export async function getNodesList() {
    // 1. Try cache first
    const cachedData = getCachedNodes();
    if (cachedData) {
        return cachedData;
    }

    // 2. If miss, fetch from DB
    const data = await fetchNodesFromDb();

    // 3. Update cache
    setCachedNodes(data);

    return data;
}

/**
 * Force refresh the nodes cache
 * Should be called after cron jobs (gossip sync, stats updater)
 */
export async function refreshNodesCache() {
    console.log("🔄 Refreshing Nodes Cache...");

    // Clear existing cache
    clearNodesCache();

    try {
        const data = await fetchNodesFromDb();
        setCachedNodes(data);
        console.log("✅ Nodes Cache Refreshed");
    } catch (error) {
        console.error("❌ Failed to refresh nodes cache:", error);
    }
}

/**
 * Core logic to fetch all nodes from DB
 * Extracted from app/api/nodes/route.ts
 */
async function fetchNodesFromDb() {
    // 1. Fetch ALL nodes from DB
    // We fetch everything and handle pagination/filtering on the client or in API route
    // But since we are caching the *result* to be served by API, we should return the raw list
    // and let the API route slice it if needed? 
    // Actually, the current API route fetches *paginated* data from DB.
    // However, since we increased limit to 1000+, we are effectively fetching ALL nodes.
    // The most efficient way is to cache the FULL list of nodes formatted for the frontend.

    const allNodes = await db.node.findMany({
        orderBy: { credits: 'desc' }
    });

    // Calculate Aggregates
    const totalStorage = allNodes.reduce((acc, n) => acc + n.storage, 0);
    const totalCredits = allNodes.reduce((acc, n) => acc + n.credits, 0);
    const activeNodes = allNodes.filter(n => n.status === 'active' || n.status === 'Active').length;
    const avgUptime = allNodes.length > 0 ? allNodes.reduce((acc, n) => acc + n.uptime, 0) / allNodes.length : 0;

    // Convert BigInt to strings for JSON serialization
    const formattedNodes = allNodes.map(node => ({
        ...node,
        packetsReceived: node.packetsReceived.toString(),
        packetsSent: node.packetsSent.toString()
    }));

    return {
        nodes: formattedNodes,
        stats: {
            totalStorage,
            totalCredits,
            activeNodes,
            totalNodes: allNodes.length,
            avgUptime
        },
        // We return a "virtual" pagination for the full list
        // The API route can override this if specific page is requested from the full list?
        // Wait, if we cache the response, we cache the *whole* list.
        // The API caller (dashboard) requests limit=1000 now.
        // So we can just return this structure.
        timestamp: Date.now()
    };
}
