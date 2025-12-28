'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { XandeumNode } from '@/lib/xandeum-client';
import dynamic from 'next/dynamic';
import {
    Activity,
    Server,
    Database,
    Globe,
    RefreshCcw,
    Search,
    SlidersHorizontal,
    ChevronRight,
    Cpu,
    Zap,
    Scale,
    ArrowUpDown
} from 'lucide-react';
import ActiveNodesChart from './ActiveNodesChart';
import Link from 'next/link';

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
    const [showScorer, setShowScorer] = useState(true);
    const [compareList, setCompareList] = useState<string[]>([]);

    // Persist weights
    useEffect(() => {
        const saved = localStorage.getItem('xandeum_priority_weights');
        if (saved) {
            try { setWeights(JSON.parse(saved)); } catch (e) { }
        }
    }, []);

    const handleWeightChange = (key: keyof PriorityWeights, value: number) => {
        const newWeights = { ...weights, [key]: value };
        setWeights(newWeights);
        localStorage.setItem('xandeum_priority_weights', JSON.stringify(newWeights));
    };

    const toggleCompare = (ip: string) => {
        if (compareList.includes(ip)) {
            setCompareList(compareList.filter(i => i !== ip));
        } else {
            if (compareList.length < 3) {
                setCompareList([...compareList, ip]);
            }
        }
    };

    const nodes: XandeumNode[] = data?.nodes || [];
    const stats = data?.stats || { totalStorage: 0, totalCredits: 0, activeNodes: 0, totalNodes: 0, avgUptime: 0 };

    // Priority Scorer Logic (Unchanged)
    const scoredNodes = useMemo(() => {
        if (!nodes.length) return [];
        const maxCredits = Math.max(...nodes.map(n => n.credits));
        const minCredits = Math.min(...nodes.map(n => n.credits));
        const maxUptime = Math.max(...nodes.map(n => n.uptime));
        const minUptime = Math.min(...nodes.map(n => n.uptime));
        const maxStorage = Math.max(...nodes.map(n => n.storage));
        const minStorage = Math.min(...nodes.map(n => n.storage));

        const normalize = (val: number, min: number, max: number) => {
            if (max === min) return 0;
            return (val - min) / (max - min);
        }

        return nodes.map(node => {
            const normCredits = normalize(node.credits, minCredits, maxCredits);
            const normUptime = normalize(node.uptime, minUptime, maxUptime);
            const normStorage = normalize(node.storage, minStorage, maxStorage);
            let totalWeight = weights.credits + weights.uptime + weights.storage;
            if (totalWeight === 0) totalWeight = 1;
            const score = ((normCredits * weights.credits) + (normUptime * weights.uptime) + (normStorage * weights.storage)) / totalWeight;
            return { ...node, score };
        }).sort((a, b) => b.score - a.score);
    }, [nodes, weights]);

    const filteredNodes = scoredNodes.filter(n =>
        n.ip.includes(search) ||
        (n.country && n.country.toLowerCase().includes(search.toLowerCase())) ||
        (n.version && n.version.includes(search))
    );

    // Curated "Clean Crypto" Palette for Avatars
    const AVATAR_COLORS = [
        'bg-teal-500',
        'bg-emerald-500',
        'bg-cyan-500',
        'bg-sky-500',
        'bg-blue-500',
        'bg-indigo-500',
        'bg-violet-500',
        'bg-slate-500' // Fail-safe
    ];

    const getAvatarColorClass = (ip: string) => {
        const hash = ip.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        const index = Math.abs(hash) % (AVATAR_COLORS.length - 1); // Exclude slate from random
        return AVATAR_COLORS[index];
    };

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [search, weights]);

    const paginatedNodes = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredNodes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredNodes, currentPage]);

    const totalPages = Math.ceil(filteredNodes.length / ITEMS_PER_PAGE);

    return (
        <div className="min-h-screen bg-zinc-50/50 dark:bg-black pb-32">

            {/* 1. Cluster Info Panel (Header) */}
            <div className="bg-white dark:bg-zinc-900/50 backdrop-blur-xl border-b border-zinc-200 dark:border-white/5 shadow-sm relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                                <Activity className="text-teal-600 dark:text-teal-400" />
                                Xandeum Network
                            </h1>
                            <p className="text-zinc-500 text-sm mt-1">Validator Leaderboard & Cluster Status</p>
                        </div>
                        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-full text-sm font-medium border border-emerald-100 dark:border-emerald-800">
                            <span className="relative flex h-2.5 w-2.5 mr-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            All Systems Operational
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-50 dark:bg-white/5 p-6 rounded-2xl border border-zinc-100 dark:border-white/5">
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Storage</span>
                            <div className="text-2xl font-bold text-zinc-900 dark:text-white flex items-baseline gap-1">
                                {stats.totalStorage.toFixed(2)} <span className="text-sm font-medium text-zinc-500">PB</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Nodes</span>
                            <div className="text-2xl font-bold text-zinc-900 dark:text-white flex items-baseline gap-1">
                                {stats.activeNodes} <span className="text-sm font-medium text-zinc-500">/ {stats.totalNodes}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Credits</span>
                            <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {stats.totalCredits.toLocaleString()}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Avg Uptime</span>
                            <div className="text-2xl font-bold text-zinc-900 dark:text-white flex items-baseline gap-1">
                                {(stats.avgUptime / 3600).toFixed(1)} <span className="text-sm font-medium text-zinc-500">Hours</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* 2. Charts Section */}
                <div className="grid grid-cols-1">
                    <ActiveNodesChart />
                </div>

                {/* 3. Validator List Controls & Priority Settings */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/5 shadow-sm z-20 overflow-hidden transition-all">

                    {/* Top Bar: Togglers & Search */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4">
                        <button
                            onClick={() => setShowScorer(!showScorer)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${showScorer
                                ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/20 dark:border-teal-800 dark:text-teal-400 ring-2 ring-teal-500/20'
                                : 'bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <SlidersHorizontal size={16} />
                            Scoring Weights
                        </button>

                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search by IP, Country, Version..."
                                className="pl-10 pr-4 py-2 w-full border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Expandable Priority Settings Panel */}
                    <div className={`
                        grid transition-all duration-300 ease-in-out
                        ${showScorer ? 'grid-rows-[1fr] opacity-100 border-t border-zinc-100 dark:border-white/5' : 'grid-rows-[0fr] opacity-0'}
                    `}>
                        <div className="overflow-hidden">
                            <div className="p-6 bg-zinc-50/50 dark:bg-zinc-800/20">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {Object.entries(weights).map(([key, val]) => (
                                        <div key={key} className="space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-semibold capitalize text-zinc-700 dark:text-zinc-300">{key} Importance</span>
                                                <span className="text-teal-600 dark:text-teal-400 font-mono">{val}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0" max="100"
                                                value={val}
                                                onChange={(e) => handleWeightChange(key as keyof PriorityWeights, Number(e.target.value))}
                                                className="w-full accent-teal-600 h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Validator Cards List */}
                <div className="grid gap-3">
                    {paginatedNodes.length > 0 && (
                        /* Table Headers for standard alignment */
                        <div className="hidden md:grid md:grid-cols-[280px_100px_1fr_1fr_1fr_100px_140px] gap-4 px-6 py-2 text-xs font-bold text-zinc-400 uppercase tracking-wider text-left">
                            <div>Validator</div>
                            <div>Status</div>
                            <div>Score</div>
                            <div>Credits</div>
                            <div>Storage</div>
                            <div className="text-right">Uptime</div>
                            <div className="text-right">Actions</div>
                        </div>
                    )}

                    {paginatedNodes.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700">
                            <div className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-4">
                                <Search size={48} strokeWidth={1} />
                            </div>
                            <h3 className="text-lg font-medium text-zinc-900 dark:text-white">No nodes found</h3>
                            <p className="text-zinc-500">Try adjusting your search filters.</p>
                        </div>
                    ) : (
                        paginatedNodes.map((node, index) => (
                            <div
                                key={node.ip}
                                className={`group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-xl px-6 py-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-teal-500/30 ${compareList.includes(node.ip) ? 'ring-2 ring-teal-500/50 border-teal-500 z-10' : ''}`}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-[280px_100px_1fr_1fr_1fr_100px_140px] gap-4 items-center">

                                    {/* Col 1: Identity */}
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className="flex-shrink-0 w-6 text-center font-mono text-zinc-400 text-sm">
                                            #{((currentPage - 1) * ITEMS_PER_PAGE) + index + 1}
                                        </div>
                                        <div
                                            className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner ${getAvatarColorClass(node.ip)}`}
                                        >
                                            {node.ip.split('.')[0].slice(0, 2)}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-bold text-zinc-900 dark:text-white font-mono truncate">{node.ip}</span>
                                            {node.country && (
                                                <span className="text-xs text-zinc-500 flex items-center gap-1 truncate">
                                                    <Globe size={10} /> {node.country}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Col 2: Status */}
                                    <div>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide border ${node.status === 'active'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400'
                                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400'}`}>
                                            {node.status}
                                        </span>
                                    </div>

                                    {/* Col 3: Score */}
                                    <div>
                                        <div className="md:hidden text-xs text-zinc-400 mb-1">Score</div>
                                        <div className="font-bold text-zinc-900 dark:text-white text-base flex items-center gap-2">
                                            {node.score.toFixed(2)}
                                            <div className={`h-1.5 w-1.5 rounded-full ${node.score > 0.75 ? 'bg-emerald-500' : node.score > 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                        </div>
                                    </div>

                                    {/* Col 4: Credits */}
                                    <div>
                                        <div className="md:hidden text-xs text-zinc-400 mb-1">Credits</div>
                                        <div className="font-mono text-sm text-zinc-700 dark:text-zinc-300">{node.credits.toLocaleString()}</div>
                                    </div>

                                    {/* Col 5: Storage */}
                                    <div>
                                        <div className="md:hidden text-xs text-zinc-400 mb-1">Storage</div>
                                        <div className="font-mono text-sm text-zinc-700 dark:text-zinc-300">{node.storage.toFixed(2)} GB</div>
                                    </div>

                                    {/* Col 6: Uptime */}
                                    <div className="md:text-right">
                                        <div className="md:hidden text-xs text-zinc-400 mb-1">Uptime</div>
                                        <div className="font-mono text-sm text-zinc-500">{(node.uptime / 3600).toFixed(0)}h</div>
                                    </div>

                                    {/* Col 7: Actions */}
                                    <div className="flex items-center gap-2 md:justify-end">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleCompare(node.ip);
                                            }}
                                            className={`transition-all px-3 py-1.5 text-xs font-medium rounded-lg border ${compareList.includes(node.ip)
                                                ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800'
                                                : 'bg-white text-zinc-600 border-zinc-200 hover:border-teal-400 hover:text-teal-600 dark:bg-zinc-800/50 dark:border-white/5 dark:text-zinc-400'}`}
                                        >
                                            {compareList.includes(node.ip) ? 'Remove' : 'Compare'}
                                        </button>
                                        <a
                                            href={`/node/${node.ip}`}
                                            className="p-2 text-zinc-400 hover:text-white hover:bg-teal-500/20 rounded-lg transition-colors"
                                        >
                                            <ChevronRight size={18} />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-8">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-zinc-500">
                            Page <span className="font-medium text-zinc-900 dark:text-white">{currentPage}</span> of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>


            {/* Floating Compare Button */}
            {compareList.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="bg-zinc-900/90 backdrop-blur-md text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 border border-zinc-700/50">
                        <div className="flex items-center gap-3">
                            <Scale size={20} className="text-teal-400" />
                            <span className="font-medium">{compareList.length} Validators Selected</span>
                        </div>
                        <div className="h-4 w-px bg-zinc-700" />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCompareList([])}
                                className="px-4 py-2 hover:bg-white/10 rounded-full text-xs font-medium transition-colors"
                            >
                                Clear
                            </button>
                            <Link
                                href={`/compare?ips=${compareList.join(',')}`}
                                className="bg-teal-500 hover:bg-teal-400 text-white px-6 py-2 rounded-full text-xs font-bold shadow-lg shadow-teal-500/20 transition-all transform hover:scale-105"
                            >
                                Compare Now
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
