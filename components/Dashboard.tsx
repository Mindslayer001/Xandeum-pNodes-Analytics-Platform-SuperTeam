
'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { XandeumNode } from '@/lib/xandeum-client';
import { StatsCard } from './StatsCard';
import dynamic from 'next/dynamic';
import { Activity, Server, Database, Globe, RefreshCcw, Search, SlidersHorizontal, ArrowDownWideNarrow } from 'lucide-react';

const Map = dynamic(() => import('./Map'), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl flex items-center justify-center text-zinc-400">Loading Map...</div>
});

import ActiveNodesChart from './ActiveNodesChart';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface PriorityWeights {
    credits: number;
    uptime: number;
    storage: number;
}

export default function Dashboard() {
    const { data, error, isLoading, mutate } = useSWR('/api/nodes', fetcher, {
        refreshInterval: 30000
    });

    const [search, setSearch] = useState("");
    const [weights, setWeights] = useState<PriorityWeights>({ credits: 50, uptime: 30, storage: 20 });
    const [showScorer, setShowScorer] = useState(false);

    // Persist weights
    useEffect(() => {
        const saved = localStorage.getItem('xandeum_priority_weights');
        if (saved) {
            try {
                setWeights(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved weights");
            }
        }
    }, []);

    const handleWeightChange = (key: keyof PriorityWeights, value: number) => {
        const newWeights = { ...weights, [key]: value };
        setWeights(newWeights);
        localStorage.setItem('xandeum_priority_weights', JSON.stringify(newWeights));
    };

    const nodes: XandeumNode[] = data?.nodes || [];
    const stats = data?.stats || { totalStorage: 0, totalCredits: 0, activeNodes: 0, totalNodes: 0, avgUptime: 0 };

    // Priority Scorer Logic
    const scoredNodes = useMemo(() => {
        if (!nodes.length) return [];

        const maxCredits = Math.max(...nodes.map(n => n.credits));
        const minCredits = Math.min(...nodes.map(n => n.credits));

        const maxUptime = Math.max(...nodes.map(n => n.uptime));
        const minUptime = Math.min(...nodes.map(n => n.uptime));

        const maxStorage = Math.max(...nodes.map(n => n.storage));
        const minStorage = Math.min(...nodes.map(n => n.storage));

        const normalize = (val: number, min: number, max: number) => {
            if (max === min) return 0; // Avoid divide by zero
            return (val - min) / (max - min);
        }

        return nodes.map(node => {
            const normCredits = normalize(node.credits, minCredits, maxCredits);
            const normUptime = normalize(node.uptime, minUptime, maxUptime);
            const normStorage = normalize(node.storage, minStorage, maxStorage);

            // Calculate Total Weight
            let totalWeight = weights.credits + weights.uptime + weights.storage;
            if (totalWeight === 0) totalWeight = 1;

            // Calculate Weighted Score
            const score = (
                (normCredits * weights.credits) +
                (normUptime * weights.uptime) +
                (normStorage * weights.storage)
            ) / totalWeight;

            return { ...node, score };
        }).sort((a, b) => b.score - a.score);

    }, [nodes, weights]);

    const filteredNodes = scoredNodes.filter(n =>
        n.ip.includes(search) ||
        (n.country && n.country.toLowerCase().includes(search.toLowerCase())) ||
        (n.version && n.version.includes(search))
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Network Analytics
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Xandeum Validator Network Status</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Live System
                    </div>
                </div>
            </div>

            {/* Design B: Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Panel: Map */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="h-[400px] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm relative z-0">
                        <Map nodes={filteredNodes} />
                    </div>
                </div>

                {/* Right Panel: KPIs */}
                <div className="lg:col-span-1 space-y-4">
                    <StatsCard
                        title="Total Storage"
                        value={`${stats.totalStorage.toFixed(2)} PB`}
                        icon={Database}
                    />
                    <StatsCard
                        title="Active Nodes"
                        value={stats.activeNodes}
                        subtext={`of ${stats.totalNodes} total scanned`}
                        icon={Activity}
                    />
                    <StatsCard
                        title="Total Credits"
                        value={stats.totalCredits.toLocaleString()}
                        icon={Server}
                    />
                    <StatsCard
                        title="Avg Uptime"
                        value={`${(stats.avgUptime / 3600).toFixed(1)}h`}
                        subtext="Network Average"
                        icon={Globe}
                    />
                </div>
            </div>

            {/* Network Charts */}
            <div className="grid grid-cols-1">
                <ActiveNodesChart />
            </div>

            {/* Priority Scorer & Table Section */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold">Validator Nodes</h2>
                        <button
                            onClick={() => setShowScorer(!showScorer)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showScorer
                                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                                : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'
                                }`}
                        >
                            <SlidersHorizontal size={16} />
                            Priority Settings
                        </button>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search IP, Country..."
                                className="pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => mutate()}
                            disabled={isLoading}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400"
                        >
                            <RefreshCcw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Priority Scorer Controls */}
                {showScorer && (
                    <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">Credits Weight</span>
                                <span className="text-blue-600 dark:text-blue-400">{weights.credits}%</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="100"
                                value={weights.credits}
                                onChange={(e) => handleWeightChange('credits', Number(e.target.value))}
                                className="w-full accent-blue-600 h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">Uptime Weight</span>
                                <span className="text-blue-600 dark:text-blue-400">{weights.uptime}%</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="100"
                                value={weights.uptime}
                                onChange={(e) => handleWeightChange('uptime', Number(e.target.value))}
                                className="w-full accent-blue-600 h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">Storage Weight</span>
                                <span className="text-blue-600 dark:text-blue-400">{weights.storage}%</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="100"
                                value={weights.storage}
                                onChange={(e) => handleWeightChange('storage', Number(e.target.value))}
                                className="w-full accent-blue-600 h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                            />
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-3 font-medium cursor-help" title="Composite Score based on Weights">
                                    <div className="flex items-center gap-1">
                                        Score
                                        <ArrowDownWideNarrow size={14} />
                                    </div>
                                </th>
                                <th className="px-6 py-3 font-medium">IP Address</th>
                                <th className="px-6 py-3 font-medium">Status</th>
                                <th className="px-6 py-3 font-medium">Country</th>
                                <th className="px-6 py-3 font-medium text-right">Storage (PB)</th>
                                <th className="px-6 py-3 font-medium text-right">Credits</th>
                                <th className="px-6 py-3 font-medium text-right">Uptime</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {filteredNodes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                                        No nodes found matching your search.
                                    </td>
                                </tr>
                            ) : filteredNodes.map((node) => (
                                <tr
                                    key={node.ip}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                    onClick={() => window.location.href = `/node/${node.ip}`}
                                >
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-md text-xs font-bold ${node.score > 0.75 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            node.score > 0.40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                            }`}>
                                            {node.score.toFixed(2)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-300">{node.ip}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold ${(node.status === 'active' || node.status === 'Active')
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                                            }`}>
                                            {node.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{node.country || 'Unknown'}</td>
                                    <td className="px-6 py-4 text-right font-medium">{node.storage.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-mono text-zinc-600 dark:text-zinc-400">{node.credits}</td>
                                    <td className="px-6 py-4 text-right text-xs text-zinc-500">
                                        {(node.uptime / 3600).toFixed(1)}h
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
