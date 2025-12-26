
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    subtext?: string;
    className?: string;
}

export function StatsCard({ title, value, icon: Icon, subtext, className }: StatsCardProps) {
    return (
        <div className={cn("bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm", className)}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
                    <h3 className="text-2xl font-bold mt-1 text-zinc-900 dark:text-white">{value}</h3>
                    {subtext && <p className="text-xs text-zinc-500 mt-1">{subtext}</p>}
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                    <Icon className="w-6 h-6 text-blue-500" />
                </div>
            </div>
        </div>
    );
}
