# Two-Tier Cron System

## Overview
The Xandeum data collection system now uses a two-tier approach for optimal performance and data freshness:

1. **Stats Updater** - High-frequency node stats updates (every 5 minutes)
2. **Gossip Sync** - Lower-frequency network topology sync (every 15-30 minutes)

---

## 1. Stats Updater (`/api/cron/stats-updater`)

### Purpose
Updates individual node statistics by directly querying each node's stats endpoint.

### Frequency
**Every 5 minutes**

### What It Does
- Iterates through ALL nodes in the database
- Calls `getStats(ip)` for each node
- Updates node-level metrics:
  - ✅ CPU usage
  - ✅ RAM usage (percent, used, total)
  - ✅ Storage
  - ✅ Uptime
  - ✅ Active streams
  - ✅ Network packets (sent/received)
  - ✅ Status (active/inactive based on response)
- Creates snapshots for historical tracking
- Progressive updates (updates DB after each node)

### Advantages
- ✅ Fresh data every 5 minutes
- ✅ Direct node-level metrics
- ✅ Progressive updates prevent data loss if timeout
- ✅ Isolated error handling per node

### API Endpoint
```bash
POST http://localhost:3000/api/cron/stats-updater
```

### Response
```json
{
  "success": true,
  "nodesProcessed": 270,
  "nodesUpdated": 245,
  "snapshotsCreated": 245,
  "totalNodes": 270,
  "durationMs": 240000,
  "message": "Stats updater completed: 245/270 nodes updated, 245 snapshots created"
}
```

### Duration
~4 minutes for 270 nodes (depends on network)

---

## 2. Gossip Sync (`/api/cron/gossip-sync`)

### Purpose
Syncs the master node list from the Xandeum gossip network to discover new nodes and update network topology.

### Frequency
**Every 15-30 minutes**

### What It Does
- Uses `get-pods-with-stats` RPC method
- Fetches complete node list from gossip network
- Updates network topology fields:
  - ✅ Node discovery (adds new nodes)
  - ✅ Public keys
  - ✅ Version info
  - ✅ Geo location (country, lat, lon)
  - ✅ Credits
  - ✅ Base uptime from gossip
- Does NOT overwrite stats updated by stats-updater

### Intelligent Fallback Mechanism
```
1. Query DB for top 20 active public nodes
2. Shuffle for load balancing
3. Try each node until one responds
4. If all fail, use hardcoded fallback nodes
5. Only needs ONE successful response
```

### Dynamic RPC Endpoints
- Uses **active public nodes** from your own database as RPC endpoints
- Automatically adapts as network changes
- Reduces dependency on hardcoded nodes

### API Endpoint
```bash
POST http://localhost:3000/api/cron/gossip-sync
```

### Response
```json
{
  "success": true,
  "nodesProcessed": 270,
  "totalNodes": 270,
  "durationMs": 45000,
  "message": "Gossip sync completed: 270/270 nodes synced"
}
```

### Duration
~30-60 seconds

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CRON SYSTEM                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  STATS UPDATER (Every 5 mins)                  │         │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │         │
│  │                                                 │         │
│  │  For each node in DB:                          │         │
│  │    ├─ GET /stats from node IP                  │         │
│  │    ├─ Update: CPU, RAM, Storage, Uptime        │         │
│  │    ├─ Update: Packets, Streams, Status         │         │
│  │    └─ Create snapshot                          │         │
│  │                                                 │         │
│  │  ✓ Progressive DB updates                      │         │
│  │  ✓ Individual error handling                   │         │
│  │  ✓ ~4 min completion time                      │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  GOSSIP SYNC (Every 15-30 mins)                │         │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │         │
│  │                                                 │         │
│  │  1. Get active nodes from DB as RPC sources    │         │
│  │  2. Try RPC: get-pods-with-stats               │         │
│  │     ├─ Try node 1 → Success? Done! ✓           │         │
│  │     ├─ Try node 2 → Success? Done! ✓           │         │
│  │     └─ Fallback to hardcoded if all fail       │         │
│  │  3. Process gossip data:                       │         │
│  │     ├─ Discover new nodes                      │         │
│  │     ├─ Update: Pubkey, Version, Geo            │         │
│  │     ├─ Update: Credits, Base Uptime            │         │
│  │     └─ Don't overwrite stats fields            │         │
│  │                                                 │         │
│  │  ✓ Intelligent fallback                        │         │
│  │  ✓ Network topology sync                       │         │
│  │  ✓ ~30-60 sec completion time                  │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup with Vercel Cron

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/stats-updater",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/gossip-sync",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Schedules:**
- `*/5 * * * *` = Every 5 minutes
- `*/15 * * * *` = Every 15 minutes

---

## Manual Testing

### Test Stats Updater
```bash
curl -X POST http://localhost:3000/api/cron/stats-updater
```

Expected: ~4 minutes to complete, updates all node stats

### Test Gossip Sync
```bash
curl -X POST http://localhost:3000/api/cron/gossip-sync
```

Expected: ~30-60 seconds to complete, syncs node list

---

## Database Field Ownership

### Stats Updater Fields
These are updated by stats-updater only:
- `cpuPercent`
- `ramUsage`
- `ramUsed`
- `ramTotal`
- `activeStreams`
- `packetsReceived`
- `packetsSent`
- `status` (based on stats response)

### Gossip Sync Fields
These are updated by gossip-sync only:
- `pubkey`
- `version`
- `country`
- `lat`
- `lon`
- `credits`

### Shared Fields
These can be updated by both (gossip provides base, stats provides accurate):
- `storage` (stats-updater gets accurate measurement)
- `uptime` (stats-updater gets accurate measurement)
- `status` (stats-updater provides real-time status)

---

## Benefits

### 🚀 Performance
- Stats updates don't wait for gossip sync
- Parallel operations possible
- Faster data freshness

### 🎯 Accuracy
- Direct node queries for stats
- Gossip for network topology
- Best of both worlds

### 💪 Resilience
- Independent failures
- Fallback mechanisms
- Progressive updates

### 📊 Efficiency
- Each cron does one thing well
- No redundant work
- Optimal frequency per task

---

## Migration from Old System

The old `/api/cron/assembler` is now **deprecated**. Replace it with:

1. **Stats Updater** - for node statistics
2. **Gossip Sync** - for network topology

Both crons include:
- ✅ Error logging to database
- ✅ Individual node error handling  
- ✅ Detailed progress logging
- ✅ Comprehensive metrics

---

## Monitoring

Check error logs:
```bash
curl http://localhost:3000/api/errors?source=cron/stats-updater
curl http://localhost:3000/api/errors?source=cron/gossip-sync
```

Or use the check script:
```bash
npx tsx scripts/check-errors.ts
```
