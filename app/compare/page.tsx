'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Check, X, Minus, Activity, Server, Database, Clock, MapPin } from 'lucide-react';
import { XandeumNode } from '@/lib/xandeum-client';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl flex items-center justify-center text-zinc-400">Loading Map...</div>
});

const fetcher = (url: string) => fetch(url).then(r => r.json());

function CompareContent() {
    const searchParams = useSearchParams();
    const ipsParam = searchParams.get('ips');
    const targetIps = useMemo(() => ipsParam ? ipsParam.split(',') : [], [ipsParam]);

    const { data, isLoading } = useSWR('/api/nodes', fetcher, {
        refreshInterval: 0 // No auto-refresh for static compare view unless needed
    });

    const nodes: XandeumNode[] = data?.nodes || [];

    const compareNodes = useMemo(() => {
        return nodes.filter(node => targetIps.includes(node.ip));
    }, [nodes, targetIps]);

    // Color generator for avatars (reused from Dashboard)
    const getAvatarColor = (ip: string) => {
        const hash = ip.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent"></div>
                    <p className="text-zinc-500">Loading Comparison...</p>
                </div>
            </div>
        );
    }

    if (compareNodes.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-zinc-50 dark:bg-black">
                <h1 className="text-2xl font-bold mb-2">No Validators Selected</h1>
                <p className="text-zinc-500 mb-6">Select validators from the dashboard to compare them.</p>
                <Link href="/" className="bg-teal-600 text-white px-6 py-2 rounded-full font-medium hover:bg-teal-500 transition-colors">
                    Go to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 p-4 md:p-8 pb-32">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-zinc-600 dark:text-zinc-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Compare Validators</h1>
                        <p className="text-zinc-500 text-sm">Comparing {compareNodes.length} nodes</p>
                    </div>
                </div>

                {/* Comparison Table */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400">
                                <tr>
                                    <th className="px-6 py-4 font-medium min-w-[200px]">Feature</th>
                                    {compareNodes.map(node => (
                                        <th key={node.ip} className="px-6 py-4 font-medium min-w-[200px]">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner"
                                                    style={{ backgroundColor: getAvatarColor(node.ip) }}
                                                >
                                                    {node.ip.split('.')[0].slice(0, 2)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-900 dark:text-white font-mono">{node.ip}</span>
                                                    <span className="text-[10px] font-normal opacity-75">{node.country}</span>
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">

                                {/* Status */}
                                <tr>
                                    <td className="px-6 py-4 font-medium text-zinc-500"><Activity size={16} className="inline mr-2" /> Status</td>
                                    {compareNodes.map(node => (
                                        <td key={node.ip} className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${node.status === 'active'
                                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'}`}>
                                                {node.status}
                                            </span>
                                        </td>
                                    ))}
                                </tr>

                                {/* Score (computed roughly for display if needed, or just skip if complex logic resides in dashboard state.
                                    Actually, the API returns raw data. We don't have the 'score' property on the raw API object usually unless we replicate logic.
                                    Let's skip 'Score' for now or replicate basic logic if needed. 
                                    Wait, the node object from API doesn't have score pre-calculated, resizing logic works in Dashboard.
                                    I will omit Score for now or add it later if user asks, to keep it simple and accurate.
                                */}

                                {/* Credits */}
                                <tr>
                                    <td className="px-6 py-4 font-medium text-zinc-500"><Activity size={16} className="inline mr-2" /> Credits</td>
                                    {compareNodes.map(node => (
                                        <td key={node.ip} className="px-6 py-4 font-mono text-zinc-700 dark:text-zinc-300">
                                            {node.credits.toLocaleString()}
                                        </td>
                                    ))}
                                </tr>

                                {/* Storage */}
                                <tr>
                                    <td className="px-6 py-4 font-medium text-zinc-500"><Database size={16} className="inline mr-2" /> Storage</td>
                                    {compareNodes.map(node => (
                                        <td key={node.ip} className="px-6 py-4 font-mono text-zinc-700 dark:text-zinc-300">
                                            {node.storage.toFixed(2)} GB
                                        </td>
                                    ))}
                                </tr>

                                {/* Uptime */}
                                <tr>
                                    <td className="px-6 py-4 font-medium text-zinc-500"><Clock size={16} className="inline mr-2" /> Uptime</td>
                                    {compareNodes.map(node => (
                                        <td key={node.ip} className="px-6 py-4 font-mono text-zinc-700 dark:text-zinc-300">
                                            {(node.uptime / 3600).toFixed(1)} hours
                                        </td>
                                    ))}
                                </tr>

                                {/* Version */}
                                <tr>
                                    <td className="px-6 py-4 font-medium text-zinc-500"><Server size={16} className="inline mr-2" /> Version</td>
                                    {compareNodes.map(node => (
                                        <td key={node.ip} className="px-6 py-4 font-mono text-zinc-700 dark:text-zinc-300">
                                            {node.version || 'Unknown'}
                                        </td>
                                    ))}
                                </tr>

                                {/* Location */}
                                <tr>
                                    <td className="px-6 py-4 font-medium text-zinc-500"><MapPin size={16} className="inline mr-2" /> Location</td>
                                    {compareNodes.map(node => (
                                        <td key={node.ip} className="px-6 py-4 text-zinc-700 dark:text-zinc-300">
                                            {node.country || 'Unknown'}
                                        </td>
                                    ))}
                                </tr>

                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Map Section */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <MapPin className="text-teal-600" />
                        Node Locations
                    </h2>
                    <div className="h-[400px] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm relative z-0">
                        <Map nodes={compareNodes} />
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function ComparePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <CompareContent />
        </Suspense>
    );
}
