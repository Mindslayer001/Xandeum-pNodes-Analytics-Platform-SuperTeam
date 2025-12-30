
'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { ArrowLeft, Server, Activity, Database, Clock, MapPin, Cpu, HardDrive } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

// Dynamic import for graphs to avoid hydration issues with Recharts
const NodeGraphs = dynamic(() => import('@/components/NodeGraphs'), { ssr: false });
const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-[300px] w-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl flex items-center justify-center text-zinc-400">Loading Map...</div>
});

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function NodeDetailsPage() {
    const params = useParams();
    const ip = params.id as string;

    const { data: response, isLoading, error } = useSWR(ip ? `/api/nodes/${ip}` : null, fetcher, {
        refreshInterval: 10000
    });

    const node = response?.node;
    const history = response?.history || [];

    // Create single-node array for the map
    const mapNodes = useMemo(() => node ? [node] : [], [node]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background p-8 flex items-center justify-center">
                <div className="space-y-4 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                    <p className="text-muted-foreground">Loading Node Details...</p>
                </div>
            </div>
        );
    }

    if (error || !response?.success || !node) {
        return (
            <div className="min-h-screen bg-background p-8 flex flex-col items-center justify-center gap-4">
                <h1 className="text-2xl font-bold text-foreground">Node Not Found</h1>
                <p className="text-muted-foreground">The requested node {ip} could not be found.</p>
                <Link href="/" className="text-primary hover:underline flex items-center gap-2">
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold text-foreground">{node.ip}</h1>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${(node.status === 'active' || node.status === 'Active')
                                    ? 'bg-transparent text-primary border-primary/20'
                                    : 'bg-secondary text-muted-foreground border-transparent'
                                    }`}>
                                    {node.status}
                                </span>
                            </div>
                            <p className="text-muted-foreground mt-1 font-mono text-sm">{node.pubkey || 'No Public Key'}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-muted-foreground text-sm">Last Updated</div>
                            <div className="font-mono text-foreground">
                                {new Date(node.updatedAt).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-card border border-border p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
                            <MapPin size={16} /> Location
                        </div>
                        <div className="font-semibold text-lg text-foreground">{node.country || 'Unknown'}</div>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
                            <Clock size={16} /> Uptime
                        </div>
                        <div className="font-semibold text-lg text-foreground">{(node.uptime / 3600).toFixed(1)}h</div>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
                            <Database size={16} /> Storage
                        </div>
                        <div className="font-semibold text-lg text-foreground">{node.storage.toFixed(2)} GB</div>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
                            <Activity size={16} /> Credits
                        </div>
                        <div className="font-semibold text-lg text-foreground">{node.credits}</div>
                    </div>
                </div>

                {/* Map Section */}
                <div className="h-[300px] border border-border rounded-lg overflow-hidden relative z-0">
                    <Map nodes={mapNodes} />
                </div>

                {/* Charts */}
                <NodeGraphs snapshots={history} />

                {/* Raw Details / JSON */}
                <div className="bg-card border border-border rounded-lg overflow-hidden p-6">
                    <h3 className="font-semibold text-lg mb-4 text-foreground">Node Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12 text-sm">
                        <div className="flex justify-between border-b border-border py-2">
                            <span className="text-muted-foreground">Software Version</span>
                            <span className="font-mono text-foreground">{node.version || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between border-b border-border py-2">
                            <span className="text-muted-foreground">Packets Received</span>
                            <span className="font-mono text-foreground">{parseInt(node.packetsReceived).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-border py-2">
                            <span className="text-muted-foreground">Packets Sent</span>
                            <span className="font-mono text-foreground">{parseInt(node.packetsSent).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-border py-2">
                            <span className="text-muted-foreground">CPU Load</span>
                            <span className="font-mono text-foreground">{node.cpuPercent}%</span>
                        </div>
                        <div className="flex justify-between border-b border-border py-2">
                            <span className="text-muted-foreground">RAM Usage</span>
                            <span className="font-mono text-foreground">{node.ramUsage.toFixed(1)}% ({node.ramUsed.toFixed(1)}/{node.ramTotal.toFixed(1)} GB)</span>
                        </div>
                    </div>
                </div>

            </div>
        </main>
    );
}
