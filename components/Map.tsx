
'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { XandeumNode } from '@/lib/xandeum-client';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix Leaflet Default Icon in Next.js
const iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

// Custom Icons
const greenIcon = L.icon({
    ...defaultIcon.options,
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
});

const grayIcon = L.icon({
    ...defaultIcon.options,
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
});

interface MapProps {
    nodes: XandeumNode[];
}

export default function Map({ nodes }: MapProps) {

    // Center map on average or default
    const position: [number, number] = [20, 0];

    return (
        <div className="h-[400px] w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 z-0">
            <MapContainer center={position} zoom={2} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {nodes.map((node, idx) => {
                    if (!node.lat || !node.lon) return null;
                    const isHealthy = node.status === 'active' || node.status === 'Active';
                    return (
                        <Marker
                            key={node.ip + idx}
                            position={[node.lat, node.lon]}
                            icon={isHealthy ? greenIcon : grayIcon}
                        >
                            <Popup>
                                <div className="text-sm">
                                    <strong className="block mb-1">{node.ip}</strong>
                                    <div className="text-xs text-zinc-600">
                                        Ver: {node.version}<br />
                                        Storage: {node.storage.toFixed(2)} PB<br />
                                        Credits: {node.credits}<br />
                                        Status: {node.status}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
