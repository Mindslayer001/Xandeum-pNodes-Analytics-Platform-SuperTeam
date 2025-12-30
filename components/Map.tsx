'use client';

import { MapContainer, TileLayer, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { XandeumNode } from '@/lib/xandeum-client';
import { useEffect, useState } from 'react';

interface ScoredNode extends XandeumNode {
    score?: number;
}

interface MapProps {
    nodes: ScoredNode[];
}

export default function Map({ nodes }: MapProps) {

    // Center map on average or default
    const position: [number, number] = [20, 0];
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // Initial detection
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setIsDarkMode(mediaQuery.matches);

        // Listener
        const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    // CartoDB Tiles (Free, nice looking)
    const lightTiles = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    const darkTiles = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

    const getColor = (score?: number) => {
        if (score === undefined) return '#71717a'; // Zinc-500 (Gray)
        if (score > 0.75) return '#22c55e'; // Green-500
        if (score > 0.40) return '#eab308'; // Yellow-500
        return '#ef4444'; // Red-500 (Low score)
    };

    return (
        <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border z-0 relative group">
            {/* Map Controls / Legend Overlay */}
            <div className="absolute top-4 right-4 z-[500] bg-background/90 backdrop-blur-sm p-3 rounded-lg border border-border text-xs space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="font-semibold text-foreground mb-1">Node Score</div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-muted-foreground">High (&gt;0.75)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    <span className="text-muted-foreground">Medium (&gt;0.40)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span className="text-muted-foreground">Low (&le;0.40)</span>
                </div>
            </div>

            <MapContainer center={position} zoom={2} scrollWheelZoom={false} style={{ height: '100%', width: '100%', background: isDarkMode ? '#202020' : '#f5f5f5' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url={isDarkMode ? darkTiles : lightTiles}
                />
                {nodes.map((node, idx) => {
                    if (!node.lat || !node.lon) return null;

                    // Deterministic jitter to prevent exact overlap
                    const jitterAmount = 0.0005; // Approx 50m
                    const hash = node.ip.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
                    const latJitter = ((hash % 100) / 100 - 0.5) * jitterAmount;
                    const lonJitter = (((hash >> 8) % 100) / 100 - 0.5) * jitterAmount;

                    const color = getColor(node.score);

                    return (
                        <CircleMarker
                            key={node.ip + idx}
                            center={[node.lat + latJitter, node.lon + lonJitter]}
                            radius={6}
                            pathOptions={{
                                fillColor: color,
                                color: isDarkMode ? '#000000' : '#ffffff', // Border color
                                weight: 1,
                                opacity: 1,
                                fillOpacity: 0.8
                            }}
                        >
                            <Popup className="custom-popup">
                                <div className="text-sm">
                                    <div className="flex items-center justify-between mb-2 gap-4">
                                        <strong className="text-zinc-900">{node.ip}</strong>
                                        {node.score !== undefined && (
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded text-white`} style={{ backgroundColor: color }}>
                                                {node.score.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-zinc-600 space-y-1">
                                        <div><span className="font-medium">Version:</span> {node.version}</div>
                                        <div><span className="font-medium">Storage:</span> {node.storage.toFixed(2)} PB</div>
                                        <div><span className="font-medium">Credits:</span> {node.credits}</div>
                                        <div><span className="font-medium">Country:</span> {node.country}</div>
                                    </div>
                                </div>
                            </Popup>
                        </CircleMarker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
