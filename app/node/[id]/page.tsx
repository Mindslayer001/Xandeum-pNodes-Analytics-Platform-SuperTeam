
'use client';

import useSWR from 'swr';
import { ArrowLeft, Server, Activity, Database, Clock, MapPin, Cpu, HardDrive } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

// Dynamic import for graphs to avoid hydration issues with Recharts
const NodeGraphs = dynamic(() => import('@/components/NodeGraphs'), { ssr: false });

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function NodeDetailsPage() {
    const params = useParams();
    const ip = params.id as string;

    const { data: response, isLoading, error } = useSWR(ip ? `/api/nodes/${ip}` : null, fetcher, {
        refreshInterval: 10000
    });

    const node = response?.node;
    const history = response?.history || [];

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black p-8 flex items-center justify-center">
                <div className="space-y-4 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="text-zinc-500">Loading Node Details...</p>
                </div>
            </div>
        );
    }

    if (error || !response?.success || !node) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black p-8 flex flex-col items-center justify-center gap-4">
                <h1 className="text-2xl font-bold text-red-500">Node Not Found</h1>
                <p className="text-zinc-500">The requested node {ip} could not be found.</p>
                <Link href="/" className="text-blue-500 hover:underline flex items-center gap-2">
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <Link href="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors mb-4">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{node.ip}</h1>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${(node.status === 'active' || node.status === 'Active')
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                    {node.status}
                                </span>
                            </div>
                            <p className="text-zinc-500 mt-1 font-mono text-sm">{node.pubkey || 'No Public Key'}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-zinc-500 text-sm">Last Updated</div>
                            <div className="font-mono text-zinc-900 dark:text-zinc-200">
                                {new Date(node.updatedAt).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 text-zinc-500 mb-2 text-sm">
                            <MapPin size={16} /> Location
                        </div>
                        <div className="font-semibold text-lg">{node.country || 'Unknown'}</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 text-zinc-500 mb-2 text-sm">
                            <Clock size={16} /> Uptime
                        </div>
                        <div className="font-semibold text-lg">{(node.uptime / 3600).toFixed(1)}h</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 text-zinc-500 mb-2 text-sm">
                            <Database size={16} /> Storage
                        </div>
                        <div className="font-semibold text-lg">{node.storage.toFixed(2)} GB</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 text-zinc-500 mb-2 text-sm">
                            <Activity size={16} /> Credits
                        </div>
                        <div className="font-semibold text-lg">{node.credits}</div>
                    </div>
                </div>

                {/* Charts */}
                <NodeGraphs snapshots={history} />

                {/* Raw Details / JSON */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden p-6">
                    <h3 className="font-semibold text-lg mb-4">Node Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12 text-sm">
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 py-2">
                            <span className="text-zinc-500">Software Version</span>
                            <span className="font-mono">{node.version || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 py-2">
                            <span className="text-zinc-500">Packets Received</span>
                            <span className="font-mono">{parseInt(node.packetsReceived).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 py-2">
                            <span className="text-zinc-500">Packets Sent</span>
                            <span className="font-mono">{parseInt(node.packetsSent).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 py-2">
                            <span className="text-zinc-500">CPU Load</span>
                            <span className="font-mono">{node.cpuPercent}%</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 py-2">
                            <span className="text-zinc-500">RAM Usage</span>
                            <span className="font-mono">{node.ramUsage.toFixed(1)}% ({node.ramUsed.toFixed(1)}/{node.ramTotal.toFixed(1)} GB)</span>
                        </div>
                    </div>
                </div>

            </div>
        </main>
    );
}
