'use client';

import { useMemo, useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import useSWR from 'swr';
import { Activity } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type TimeRange = '24h' | '7d' | '30d' | 'all';

export default function ActiveNodesChart() {
    const [selectedRange, setSelectedRange] = useState<TimeRange>('24h');

    // Load saved range from local storage
    useEffect(() => {
        const saved = localStorage.getItem('xandeum_network_stats_range');
        if (saved && ['24h', '7d', '30d', 'all'].includes(saved)) {
            setSelectedRange(saved as TimeRange);
        }
    }, []);

    const handleRangeChange = (range: TimeRange) => {
        setSelectedRange(range);
        localStorage.setItem('xandeum_network_stats_range', range);
    };

    const { data: response, isLoading } = useSWR(`/api/network-stats?range=${selectedRange}`, fetcher, {
        refreshInterval: 60000 // 1 min
    });

    const data = useMemo(() => {
        if (!response?.data?.timeSeries) return [];
        return response.data.timeSeries.map((item: any) => {
            // Format timestamp based on selected range
            let formattedTime;
            const date = new Date(item.timestamp);

            // Fix invalid date issue if timestamp is malformed
            if (isNaN(date.getTime())) {
                return { ...item, timestamp: '', active: 0, inactive: 0 };
            }

            if (selectedRange === '24h') {
                formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (selectedRange === '7d' || selectedRange === '30d') {
                formattedTime = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            } else {
                // all time
                formattedTime = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
            }

            return {
                ...item,
                timestamp: formattedTime,
                active: item.activeNodes,
                inactive: item.inactiveNodes
            };
        });
    }, [response, selectedRange]);

    const rangeButtons: { value: TimeRange; label: string }[] = [
        { value: '24h', label: '24 Hours' },
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' },
        { value: 'all', label: 'All Time' }
    ];

    if (isLoading) {
        return <div className="h-[300px] w-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl flex items-center justify-center text-zinc-400">Loading Network History...</div>;
    }

    if (!data || data.length === 0) return null;

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Activity className="text-blue-500" size={20} />
                    <h3 className="font-semibold text-lg">Network Activity</h3>
                </div>

                {/* Time Range Selector */}
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                    {rangeButtons.map((button) => (
                        <button
                            key={button.value}
                            onClick={() => handleRangeChange(button.value)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${selectedRange === button.value
                                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                        >
                            {button.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.1} />
                        <XAxis
                            dataKey="timestamp"
                            tick={{ fontSize: 12, fill: '#71717a' }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={30}
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: '#71717a' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                border: '1px solid #3f3f46',
                                borderRadius: '8px',
                                color: '#f4f4f5'
                            }}
                            itemStyle={{ color: '#e4e4e7' }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="active"
                            name="Active Nodes"
                            stroke="#22c55e"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, fill: '#22c55e' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="inactive"
                            name="Inactive Nodes"
                            stroke="#ef4444"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, fill: '#ef4444' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
