import db from '@/lib/db';
import { getCachedStats, setCachedStats, clearStatsCache } from './network-stats-cache';

/**
 * Fetch network stats for a specific range, using cache if available
 */
export async function getNetworkStats(range: string = '24h') {
    // 1. Try cache first
    const cachedData = getCachedStats(range);
    if (cachedData) {
        return cachedData;
    }

    // 2. If miss, fetch from DB
    const data = await fetchNetworkStatsFromDb(range);

    // 3. Update cache
    setCachedStats(range, data);

    return data;
}

/**
 * Force refresh the cache for all standard ranges
 * Should be called after data updates (gossip sync, stats updater)
 */
export async function refreshNetworkStatsCache() {
    console.log("🔄 Refreshing Network Stats Cache...");

    // Clear existing cache first to ensure atomicity (users will wait for new fetch)
    // Or we could just overwrite. Clearing first is safer for "atomic" feeling if fetch fails.
    clearStatsCache();

    // Fetch popular ranges in parallel
    const ranges = ['24h', '7d', '30d', 'all'];

    try {
        await Promise.all(ranges.map(async (range) => {
            const data = await fetchNetworkStatsFromDb(range);
            setCachedStats(range, data);
        }));
        console.log("✅ Network Stats Cache Refreshed");
    } catch (error) {
        console.error("❌ Failed to refresh network stats cache:", error);
    }
}

/**
 * Core logic to fetch stats from DB (extracted from original route.ts)
 */
async function fetchNetworkStatsFromDb(range: string) {
    let dateFrom = new Date();
    let groupingSeconds = 3600; // Default: 1 hour

    // Helper to calculate dynamic interval based on data age
    // If we only have 2 days of data, showing a 7-day chart with 1 point per day looks empty
    // So we increase resolution if the *actual* data is young
    const getDynamicInterval = async (startDate: Date) => {
        const oldestSnapshot = await db.nodeSnapshot.findFirst({
            orderBy: { timestamp: 'asc' },
            select: { timestamp: true }
        });
        const firstDataPoint = oldestSnapshot?.timestamp || new Date();

        // Effective start is the later of: requested start date OR actual first data point
        // But for interval calculation, we care about how much *actual data* we have to show
        let dataAgeHours = (Date.now() - firstDataPoint.getTime()) / (1000 * 60 * 60);

        // But we are also constrained by the range window. 
        // If range is 7d, maximum window is 7d.

        if (dataAgeHours <= 24) {
            return 3600; // 1 hour intervals if we have < 24h of data
        } else if (dataAgeHours <= 7 * 24) {
            return 21600; // 6 hour intervals if we have < 7 days of data
        } else {
            return 86400; // 24 hour intervals if we have plenty of data
        }
    };

    if (range === '24h') {
        dateFrom.setHours(dateFrom.getHours() - 24);
        groupingSeconds = 30; // 30 seconds (High res for 24h)
    } else if (range === '7d') {
        dateFrom.setDate(dateFrom.getDate() - 7);
        // Calculate interval dynamically based on how much data we actually have
        groupingSeconds = await getDynamicInterval(dateFrom);
    } else if (range === '30d') {
        dateFrom.setDate(dateFrom.getDate() - 30);
        groupingSeconds = await getDynamicInterval(dateFrom);
    } else if (range === 'all') {
        // Get the oldest snapshot timestamp
        const oldestSnapshot = await db.nodeSnapshot.findFirst({
            orderBy: { timestamp: 'asc' },
            select: { timestamp: true }
        });
        dateFrom = oldestSnapshot?.timestamp || new Date(Date.now() - 24 * 60 * 60 * 1000);

        // For 'all', we use similar dynamic logic
        const durationHours = (Date.now() - dateFrom.getTime()) / (1000 * 60 * 60);
        if (durationHours <= 24) {
            groupingSeconds = 3600;
        } else if (durationHours <= 7 * 24) {
            groupingSeconds = 21600; // 6 hours
        } else {
            groupingSeconds = 86400;
        }
    } else {
        // Default to 24h
        dateFrom.setHours(dateFrom.getHours() - 24);
        groupingSeconds = 30;
    }

    // Get total nodes count from Node table
    const totalNodes = await db.node.count();

    // Query NodeSnapshot data grouped by time intervals
    const timeSeriesData: any[] = await db.$queryRaw`
        WITH time_buckets AS (
            SELECT 
                "nodeIp",
                status,
                storage,
                credits,
                "cpuPercent",
                "ramUsage",
                timestamp,
                to_timestamp(
                    EXTRACT(EPOCH FROM ${dateFrom}::timestamptz) + 
                    FLOOR(EXTRACT(EPOCH FROM (timestamp - ${dateFrom}::timestamptz)) / ${groupingSeconds}) * ${groupingSeconds}
                ) as time_bucket,
                ROW_NUMBER() OVER (
                    PARTITION BY "nodeIp", 
                    to_timestamp(
                        EXTRACT(EPOCH FROM ${dateFrom}::timestamptz) + 
                        FLOOR(EXTRACT(EPOCH FROM (timestamp - ${dateFrom}::timestamptz)) / ${groupingSeconds}) * ${groupingSeconds}
                    )
                    ORDER BY timestamp DESC
                ) as rn
            FROM "NodeSnapshot"
            WHERE timestamp >= ${dateFrom}
        )
        SELECT 
            time_bucket,
            COUNT(DISTINCT "nodeIp") as total_nodes,
            COUNT(DISTINCT CASE WHEN status = 'active' THEN "nodeIp" END) as active_nodes,
            COUNT(DISTINCT CASE WHEN status = 'inactive' THEN "nodeIp" END) as inactive_nodes,
            SUM(storage) as total_storage,
            SUM(credits) as total_credits,
            AVG("cpuPercent") as avg_cpu,
            AVG("ramUsage") as avg_ram
        FROM time_buckets
        WHERE rn = 1
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
    `;

    // Get latest snapshot data for current metrics
    const latestSnapshot = await db.nodeSnapshot.findFirst({
        orderBy: { timestamp: 'desc' },
        select: {
            timestamp: true,
            status: true
        }
    });

    // Get current active/inactive breakdown from Node table
    const activeCount = await db.node.count({
        where: { status: 'active' }
    });

    const inactiveCount = await db.node.count({
        where: { status: 'inactive' }
    });

    // Format the response
    const formattedData = timeSeriesData.map((point: any) => ({
        timestamp: point.time_bucket,
        totalNodes: parseInt(point.total_nodes || '0'),
        activeNodes: parseInt(point.active_nodes || '0'),
        inactiveNodes: parseInt(point.inactive_nodes || '0'),
        totalStorage: parseFloat(point.total_storage || '0'),
        totalCredits: point.total_credits ? point.total_credits.toString() : '0',
        avgCpu: parseFloat(point.avg_cpu || '0'),
        avgRam: parseFloat(point.avg_ram || '0')
    }));

    return {
        // Current stats
        current: {
            totalNodes,
            activeNodes: activeCount,
            inactiveNodes: inactiveCount,
            lastUpdated: latestSnapshot?.timestamp || new Date()
        },
        // Historical time-series data for charts
        timeSeries: formattedData,
        // Metadata
        range,
        groupingSeconds,
        dateFrom
    };
}
