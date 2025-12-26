
'use client';

import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import { Activity, Cpu, HardDrive, Network } from 'lucide-react';

interface Snapshot {
    timestamp: string;
    cpuPercent: number;
    ramUsage: number;
    ramUsed: number;
    ramTotal: number;
    activeStreams: number;
    packetsReceived: string | number; // handle bigints as strings if they come that way
    packetsSent: string | number;
    storage: number;
    uptime: number;
}

interface NodeGraphsProps {
    snapshots: any[]; // Raw snapshots from API
}

export default function NodeGraphs({ snapshots }: NodeGraphsProps) {
    // Process data
    const data = snapshots.map(s => ({
        ...s,
        timestamp: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cpu: s.cpuPercent,
        ram: s.ramUsage,
        streams: s.activeStreams,
    }));

    if (!data.length) {
        return <div className="text-zinc-500">No history data available for graphs.</div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* CPU & RAM Usage */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Cpu className="text-indigo-500" size={20} />
                    <h3 className="font-semibold text-lg">Resource Usage</h3>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.1} />
                            <XAxis
                                dataKey="timestamp"
                                tick={{ fontSize: 12, fill: '#71717a' }}
                                axisLine={false}
                                tickLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                domain={[0, 100]}
                                tick={{ fontSize: 12, fill: '#71717a' }}
                                axisLine={false}
                                tickLine={false}
                                unit="%"
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
                            <Line type="monotone" dataKey="cpu" name="CPU Usage" stroke="#6366f1" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="ram" name="RAM Usage" stroke="#ec4899" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Active Streams */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Network className="text-teal-500" size={20} />
                    <h3 className="font-semibold text-lg">Streaming Activity</h3>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorStreams" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
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
                            <Area
                                type="step"
                                dataKey="streams"
                                name="Active Streams"
                                stroke="#14b8a6"
                                fill="url(#colorStreams)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
