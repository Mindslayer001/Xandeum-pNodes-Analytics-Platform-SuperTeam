/**
 * In-memory cache for validator nodes list
 * Reduces database load for the high-traffic /api/nodes endpoint
 */

interface CacheEntry {
    data: any;
    timestamp: number;
}

// Global cache variable
let nodesCache: CacheEntry | null = null;

export const NODES_CACHE_KEY = 'all_nodes';

/**
 * Get the cached nodes list
 */
export function getCachedNodes(): any | null {
    if (!nodesCache) return null;
    return nodesCache.data;
}

/**
 * Set the cached nodes list
 */
export function setCachedNodes(data: any): void {
    nodesCache = {
        data,
        timestamp: Date.now()
    };
}

/**
 * Clear the nodes cache
 */
export function clearNodesCache(): void {
    nodesCache = null;
}
