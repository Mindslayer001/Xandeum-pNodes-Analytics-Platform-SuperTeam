/**
 * In-memory cache for network stats to reduce database load
 * and ensure atomic views for multiple users.
 */

interface CacheEntry {
    data: any;
    timestamp: number;
}

interface StatsCache {
    [range: string]: CacheEntry;
}

// Global cache object
// Note: In a serverless environment like Vercel, this cache is per-instance.
// For a persisted global cache, Reddy/Redis would be needed.
// However, for a VPS or long-running server (npm run dev/start), this works perfectly.
let cache: StatsCache = {};

export const CACHE_TTL = 60 * 1000; // 1 minute default TTL if not explicitly refreshed

/**
 * Get cached stats for a specific range
 */
export function getCachedStats(range: string): any | null {
    const entry = cache[range];
    if (!entry) return null;
    return entry.data;
}

/**
 * Set cached stats for a specific range
 */
export function setCachedStats(range: string, data: any): void {
    cache[range] = {
        data,
        timestamp: Date.now()
    };
}

/**
 * Clear the entire cache
 * Used when data changes (e.g. after gossip sync)
 */
export function clearStatsCache(): void {
    cache = {};
}

/**
 * Check if cache exists for a range
 */
export function hasCachedStats(range: string): boolean {
    return !!cache[range];
}
