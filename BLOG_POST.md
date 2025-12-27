# Building the Xandeum Network Analytics Platform: A Deep Dive

In this post, we explore how we built a high-performance analytics dashboard for the **Xandeum Validator Network**. Our goal was to create a "source of truth" for network health, offering real-time insights into node performance, storage capacity, and economic activity.

## 🚀 The Challenge

The Xandeum network consists of hundreds of validator nodes ("pods") constantly gossiping data. We needed a system that could:
1.  **Sync Reliability**: Capture network state atomically without partial failures.
2.  **Analyze Trends**: Track historical performance (storage, uptime, credits) over time.
3.  **Perform at Scale**: Serve dashboard data instantly, even under heavy load.

## 🏗️ System Architecture

The analytics platform is designed as a **serverless, event-driven architecture** optimized for high read throughput and consistent write integrity.

### The Stack
*   **Frontend**: Next.js 14 (App Router), Tailwind CSS, Recharts
*   **Backend**: Next.js API Routes (Serverless Functions)
*   **Database**: PostgreSQL (Supabase) + Prisma ORM
*   **Orchestration**: GitHub Actions (Cron Triggers)

### The Data Pipeline
1.  **Ingestion**: A GitHub Action triggers the `gossip-sync` endpoint every 5 minutes.
2.  **Processing**: The backend fetches raw data from Xandeum RPC nodes, normalizes IPs, and resolves Geo-location.
3.  **Persistence**: Data is written to PostgreSQL inside an ACID transaction.
4.  **Caching**: Upon successful commit, the **Service Layer** refreshes the global in-memory cache.
5.  **Delivery**: Users visiting the dashboard receive cached JSON instantly, bypassing the database for read operations.

## 🛠️ Our Approach

We built the solution using **Next.js 14**, **Prisma**, and **PostgreSQL**, with a focus on robust backend architecture.

### 1. Atomic Gossip Sync (The "Heartbeat")
We moved away from simple API polling to a **Transaction-Based Sync** mechanism. Every 5 minutes, our system:
*   Fetches the latest gossip from curated RPC nodes.
*   Opens a database transaction.
*   **Marks all nodes as inactive** initially.
*   Upserts active nodes from the gossip snapshot.
*   Creates historical **NodeSnapshot** records.
*   Commits everything atomically.

This ensures that users never see a "half-updated" state. Accessing the dashboard always yields a consistent view of the network.

### 2. High-Performance Caching
To ensure instant load times, we implemented a custom **In-Memory Caching Layer**.
*   **Write-Through**: Immediately after the cron job updates the database, it proactively refreshes the cache.
*   **Read-Heavy Optimization**: API requests hit the RAM cache first, delivering responses in milliseconds vs. expensive database queries.
*   **Smart Resolution**: Our charts use dynamic bucketing—showing high-resolution (30s) data for recent activity and aggregated daily trends for historical views.

### 3. The Priority Scorer
We recognized that "best" is subjective. Some users value **Credits** (economic stake), while others value **Uptime** or **Storage**.
We built a **Client-Side Priority Scorer** that allows users to:
*   Define their own weights (e.g., *70% Uptime, 30% Storage*).
*   Visualize a normalized "Priority Score" (0.00 - 1.00) for every validator.
*   Color-code nodes (Green/Yellow/Gray) based on performance thresholds.
*   **Persist Preferences**: Using browser `localStorage`, user settings are saved automatically, providing a personalized experience every time they visit.

## 🔗 Leveraging Xandeum
We interacted directly with the Xandeum RPC layer:
*   `get-pods-with-stats`: The core data source for node discovery.
*   `get-credits`: To map public keys to economic stake.
*   **RPC Normalization**: We standardized IP handling by stripping ports for storage key consistency (`X.X.X.X`) while appending ports dynamically (`:6000`) for RPC transport.

## 🔮 What's Next?
This platform sets the foundation for deeper analytics, including predictive uptime modeling and detailed geographic distribution maps.

---
*Built with ❤️ for the Xandeum Community.*
