-- Migration: Remove ports from Node IP addresses
-- This migration updates existing IP addresses to remove the :6000 port suffix
-- and ensures all IPs are stored in the format: X.X.X.X (without port)

BEGIN;

-- Step 1: Update Node table - remove port from IP addresses
-- This uses PostgreSQL's split_part function to extract everything before the colon
UPDATE "Node"
SET ip = split_part(ip, ':', 1)
WHERE ip LIKE '%:%';

-- Step 2: Update NodeSnapshot table - remove port from nodeIp foreign keys
-- This ensures the foreign key relationship remains intact
UPDATE "NodeSnapshot"
SET "nodeIp" = split_part("nodeIp", ':', 1)
WHERE "nodeIp" LIKE '%:%';

-- Step 3: Verify the changes
-- Check if there are any remaining IPs with ports (should return 0 rows)
DO $$
DECLARE
    node_count INTEGER;
    snapshot_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO node_count FROM "Node" WHERE ip LIKE '%:%';
    SELECT COUNT(*) INTO snapshot_count FROM "NodeSnapshot" WHERE "nodeIp" LIKE '%:%';
    
    IF node_count > 0 OR snapshot_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: Still found IPs with ports after update. Node: %, Snapshot: %', node_count, snapshot_count;
    ELSE
        RAISE NOTICE 'Migration successful: All IPs updated to remove ports';
    END IF;
END $$;

COMMIT;

-- To rollback this migration (add ports back), you would need to know the original port
-- Since we're standardizing on port 6000, you could run:
-- UPDATE "Node" SET ip = ip || ':6000' WHERE ip NOT LIKE '%:%';
-- UPDATE "NodeSnapshot" SET "nodeIp" = "nodeIp" || ':6000' WHERE "nodeIp" NOT LIKE '%:%';
