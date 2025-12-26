
import axios from 'axios';
import db from './db'

export const RPC_NODES = [
    "http://216.234.134.5:6000/rpc",
    "http://161.97.185.116:6000/rpc"
]

const CREDITS_API = "https://podcredits.xandeum.network/api/pods-credits"

export type PodStats = {
    ip: string
    pubkey: string
    version: string
    storage: number // GB
    status: string
    val_addr?: string
    addr?: string
    address?: string
    node_pubkey?: string
    uptime?: number
}

export type XandeumNode = PodStats & {
    credits: number
    country: string
    lat: number
    lon: number
    uptime: number // Seconds
    cpuPercent?: number
    ramUsage?: number
    ramUsed?: number
    ramTotal?: number
    activeStreams?: number
    packetsReceived?: number
    packetsSent?: number
}

/**
 * Fixes port - replaces 9001 with 6000, or adds :6000 if no port exists
 * Used ONLY for RPC call construction, NOT for database storage
 */
export function fixPort(ipWithPort: string): string {
    if (ipWithPort.includes(":9001")) {
        return ipWithPort.replace(":9001", ":6000");
    }
    // If no port, add default :6000
    if (!ipWithPort.includes(":")) {
        return `${ipWithPort}:6000`;
    }
    return ipWithPort;
}

/**
 * Extracts IP address WITHOUT port
 * This should be used for database storage to ensure consistency
 * @returns IP in format: X.X.X.X (no port)
 */
export function extractIp(ipWithPort: string): string {
    return ipWithPort.split(":")[0];
}

/**
 * Converts IP to RPC endpoint URL with proper port
 * @param ip - IP address with or without port
 * @returns Full RPC URL: http://X.X.X.X:6000/rpc
 */
export function ipToRpcUrl(ip: string): string {
    const cleanIp = extractIp(ip);
    return `http://${cleanIp}:6000/rpc`;
}

export async function rpcCall(url: string, method: string, params: any[] = []) {
    try {
        // using axios to avoid "bad port" error with fetch on port 6000
        const res = await axios.post(url, {
            jsonrpc: "2.0",
            id: 1,
            method,
            params
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 10000 // 10s timeout
        });

        // Axios returns the data directly
        const data = res.data;
        if (data.error) throw new Error(data.error.message);
        return data.result;
    } catch (err: any) {
        console.error(`RPC Call failed to ${url}:`, err.message);
        throw err;
    }
}

export async function getPodsWithStats(): Promise<XandeumNode[]> {
    const shuffled = [...RPC_NODES].sort(() => 0.5 - Math.random());
    const errors: string[] = [];
    let rawPods: any[] = [];

    for (const node of shuffled) {
        try {
            const result = await rpcCall(node, "get-pods-with-stats");

            if (result && Array.isArray(result.pods)) {
                rawPods = result.pods;
                break;
            } else if (result && Array.isArray(result.list)) {
                rawPods = result.list;
                break;
            } else if (Array.isArray(result)) {
                rawPods = result;
                break;
            } else {
                console.error(`Invalid RPC result structure from ${node}:`, JSON.stringify(result).slice(0, 100));
            }
        } catch (e: any) {
            errors.push(`${node}: ${e.message}`);
        }
    }

    if (rawPods.length === 0) {
        console.error("All RPC nodes failed errors:", errors);
        return [];
    }

    // Fetch credits and enrich
    const creditsMap = await getCredits();
    const enriched: XandeumNode[] = [];

    // Process sequentially to avoid rate limits (especially GeoIP)
    for (const pod of rawPods) {
        let address = pod.address || pod.addr || (pod.ip ? `${pod.ip}:6000` : null);
        if (address) address = fixPort(address);

        const ip = extractIp(address || pod.ip || "0.0.0.0");
        const podPubkey = pod.pubkey || pod.node_pubkey;


        // Parallelize Stats and GeoIP per node, but sequential processing of nodes
        // prevents flooding 100 requests at once.
        const [stats, geo] = await Promise.all([
            address ? getStats(address) : null,
            resolveGeoLocation(ip)
        ]);

        // Determine uptime from stats or gossip data
        const uptime = stats?.uptime || pod.uptime || 0;

        // Infer status based on stats response OR uptime from gossip
        // If we got stats OR the node has uptime > 0, it's active
        // Only mark as inactive if no stats AND uptime is 0
        let inferredStatus: string;
        if (stats || uptime > 0) {
            inferredStatus = 'active';
        } else if (pod.status) {
            inferredStatus = pod.status;
        } else {
            inferredStatus = 'inactive';
        }

        enriched.push({
            ...pod,
            status: inferredStatus,
            credits: creditsMap[podPubkey] || 0,
            country: geo.country,
            lat: geo.lat,
            lon: geo.lon,
            cpuPercent: stats?.cpuPercent || 0,
            ramUsage: stats?.ramPercent || 0,
            ramUsed: stats?.ramUsed || 0,
            ramTotal: stats?.ramTotal || 0,
            activeStreams: stats?.activeStreams || 0,
            packetsReceived: stats?.packetsReceived || 0,
            packetsSent: stats?.packetsSent || 0,
            uptime: uptime,
            storage: stats?.fileSize ? stats.fileSize / (1024 ** 3) : (typeof pod.storage === 'string' ? parseFloat(pod.storage) : (pod.storage || 0)), // Convert bytes to GB
        } as XandeumNode);
    }

    return enriched;
}

export async function getStats(ipWithPort: string): Promise<{
    cpuPercent: number;
    ramPercent: number;
    ramUsed: number;
    ramTotal: number;
    uptime: number;
    fileSize: number;
    activeStreams: number;
    packetsReceived: number;
    packetsSent: number;
} | null> {
    try {
        const res = await axios.post(`http://${ipWithPort}/rpc`, {
            jsonrpc: "2.0",
            id: 1,
            method: "get-stats",
            params: []
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 2000 // 2s timeout
        });

        const data = res.data;
        if (!data.result) return null;

        const result = data.result;

        // Calculate RAM percentage
        const ramPercent = result.ram_total > 0
            ? (result.ram_used / result.ram_total) * 100
            : 0;

        return {
            cpuPercent: result.cpu_percent || 0,
            ramPercent: ramPercent,
            ramUsed: result.ram_used || 0,
            ramTotal: result.ram_total || 0,
            uptime: result.uptime || 0,
            fileSize: result.file_size || 0,
            activeStreams: result.active_streams || 0,
            packetsReceived: result.packets_received || 0,
            packetsSent: result.packets_sent || 0,
        };
    } catch (e) {
        return null;
    }
}

export async function getCredits(): Promise<Record<string, number>> {
    try {
        // Credits API should be fine with fetch as it is standard HTTPS
        const res = await fetch(CREDITS_API, { next: { revalidate: 60 } });
        const data = await res.json();

        const creditsMap: Record<string, number> = {};
        if (data.pods_credits && Array.isArray(data.pods_credits)) {
            data.pods_credits.forEach((item: any) => {
                if (item.pod_id && typeof item.credits === 'number') {
                    creditsMap[item.pod_id] = item.credits;
                }
            });
        }

        return creditsMap;
    } catch (e) {
        console.error("Failed to fetch credits", e);
        return {};
    }
}

// GeoIP with Caching
export async function resolveGeoLocation(ip: string) {
    const cached = await db.geoCache.findUnique({ where: { ip } });
    if (cached) return cached;

    try {
        const res = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await res.json();
        if (data.status === "success") {
            const geo = {
                ip,
                country: data.country,
                lat: data.lat,
                lon: data.lon,
            };
            await db.geoCache.create({ data: geo });
            return geo;
        }
    } catch (e) {
        console.error(`GeoIP failed for ${ip}`, e);
    }
    return { country: "Unknown", lat: 0, lon: 0 };
}
