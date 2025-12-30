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
            <div className="bg-background border-b border-border z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                        <div>
                            <h1 className="text-xl font-semibold text-foreground tracking-normal flex items-center gap-2">
                                <Activity className="text-primary w-5 h-5" />
                                Xandeum Network
                            </h1>
                            <p className="text-muted-foreground text-sm mt-1">Validator Leaderboard & Cluster Status</p>
                        </div>
                        <div className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-xs border border-border">
                            <span className="relative flex h-2 w-2 mr-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            All Systems Operational
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-card p-6 rounded-lg border border-border">
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Total Storage</span>
                            <div className="text-2xl font-bold text-foreground flex items-baseline gap-1">
                                {stats.totalStorage.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">PB</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Active Nodes</span>
                            <div className="text-2xl font-bold text-foreground flex items-baseline gap-1">
                                {stats.activeNodes} <span className="text-sm font-normal text-muted-foreground">/ {stats.totalNodes}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Total Credits</span>
                            <div className="text-2xl font-bold text-foreground">
                                {stats.totalCredits.toLocaleString()}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Avg Uptime</span>
                            <div className="text-2xl font-bold text-foreground flex items-baseline gap-1">
                                {(stats.avgUptime / 3600).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">Hours</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* 2. Charts Section - Removed as per user request */}
                {/* <div className="grid grid-cols-1">
                    <ActiveNodesChart />
                </div> */}

                {/* 3. Validator List Controls & Priority Settings */}
                <div className="bg-card rounded-lg border border-border shadow-sm z-20 overflow-hidden">

                    {/* Top Bar: Togglers & Search */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4">
                        <button
                            onClick={() => setShowScorer(!showScorer)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${showScorer
                                ? 'bg-secondary text-secondary-foreground border border-border'
                                : 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
                                }`}
                        >
                            <SlidersHorizontal size={16} />
                            Scoring Weights
                        </button>

                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by IP, Country, Version..."
                                className="pl-10 pr-4 py-2 w-full border border-input rounded-lg text-sm bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Expandable Priority Settings Panel */}
                    <div className={`
                        grid transition-all duration-300 ease-in-out
                        ${showScorer ? 'grid-rows-[1fr] opacity-100 border-t border-border' : 'grid-rows-[0fr] opacity-0'}
                    `}>
                        <div className="overflow-hidden">
                            <div className="p-6 bg-muted/20">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {Object.entries(weights).map(([key, val]) => (
                                        <div key={key} className="space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium capitalize text-foreground">{key} Importance</span>
                                                <span className="text-primary font-mono">{val}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0" max="100"
                                                value={val}
                                                onChange={(e) => handleWeightChange(key as keyof PriorityWeights, Number(e.target.value))}
                                                className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
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
                        <div className="hidden md:grid md:grid-cols-[280px_100px_1fr_1fr_1fr_100px_140px] gap-4 px-6 py-2 text-xs font-semibold text-muted-foreground text-left">
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
                        <div className="text-center py-20 bg-card rounded-lg border border-dashed border-border">
                            <div className="mx-auto h-12 w-12 text-muted-foreground mb-4">
                                <Search size={48} strokeWidth={1} />
                            </div>
                            <h3 className="text-lg font-medium text-foreground">No nodes found</h3>
                            <p className="text-muted-foreground">Try adjusting your search filters.</p>
                        </div>
                    ) : (
                        paginatedNodes.map((node, index) => (
                            <div
                                key={node.ip}
                                className={`group relative bg-card border border-border rounded-lg px-6 py-4 transition-all duration-200 hover:bg-secondary/50 ${compareList.includes(node.ip) ? 'ring-1 ring-primary border-primary z-10' : ''}`}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-[280px_100px_1fr_1fr_1fr_100px_140px] gap-4 items-center">

                                    {/* Col 1: Identity */}
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className="flex-shrink-0 w-6 text-center font-mono text-muted-foreground text-sm">
                                            #{((currentPage - 1) * ITEMS_PER_PAGE) + index + 1}
                                        </div>
                                        <div
                                            className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-secondary text-secondary-foreground font-semibold text-xs`}
                                        >
                                            {node.ip.split('.')[0].slice(0, 2)}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-semibold text-foreground font-mono truncate">{node.ip}</span>
                                            {node.country && (
                                                <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                                    <Globe size={10} /> {node.country}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Col 2: Status */}
                                    <div>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${node.status === 'active'
                                            ? 'bg-transparent text-primary border-primary/20'
                                            : 'bg-secondary text-muted-foreground border-transparent'}`}>
                                            {node.status}
                                        </span>
                                    </div>

                                    {/* Col 3: Score */}
                                    <div>
                                        <div className="md:hidden text-xs text-muted-foreground mb-1">Score</div>
                                        <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                                            {node.score.toFixed(2)}
                                            <div className={`h-1.5 w-1.5 rounded-full ${node.score > 0.75 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                                        </div>
                                    </div>

                                    {/* Col 4: Credits */}
                                    <div>
                                        <div className="md:hidden text-xs text-muted-foreground mb-1">Credits</div>
                                        <div className="font-mono text-sm text-foreground">{node.credits.toLocaleString()}</div>
                                    </div>

                                    {/* Col 5: Storage */}
                                    <div>
                                        <div className="md:hidden text-xs text-muted-foreground mb-1">Storage</div>
                                        <div className="font-mono text-sm text-foreground">{node.storage.toFixed(2)} GB</div>
                                    </div>

                                    {/* Col 6: Uptime */}
                                    <div className="md:text-right">
                                        <div className="md:hidden text-xs text-muted-foreground mb-1">Uptime</div>
                                        <div className="font-mono text-sm text-muted-foreground">{(node.uptime / 3600).toFixed(0)}h</div>
                                    </div>

                                    {/* Col 7: Actions */}
                                    <div className="flex items-center gap-2 md:justify-end">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleCompare(node.ip);
                                            }}
                                            className={`transition-all px-3 py-1.5 text-xs font-medium rounded-lg border ${compareList.includes(node.ip)
                                                ? 'bg-secondary text-foreground border-border'
                                                : 'bg-transparent text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground'}`}
                                        >
                                            {compareList.includes(node.ip) ? 'Remove' : 'Compare'}
                                        </button>
                                        <a
                                            href={`/node/${node.ip}`}
                                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
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
                            className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-muted-foreground">
                            Page <span className="font-medium text-foreground">{currentPage}</span> of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>


            {/* Floating Compare Button */}
            {compareList.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="bg-foreground text-background px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 border border-border">
                        <div className="flex items-center gap-3">
                            <Scale size={20} className="text-primary" />
                            <span className="font-medium">{compareList.length} Validators Selected</span>
                        </div>
                        <div className="h-4 w-px bg-muted" />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCompareList([])}
                                className="px-4 py-2 hover:bg-background/10 rounded-full text-xs font-medium transition-colors"
                            >
                                Clear
                            </button>
                            <Link
                                href={`/compare?ips=${compareList.join(',')}`}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-full text-xs font-bold shadow-lg transition-all"
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
