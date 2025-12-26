import db from '../lib/db';

/**
 * Migration script to remove ports from existing IP addresses in the database
 * Handles duplicate IPs by merging snapshots and keeping the most recently updated node
 * Run this BEFORE deploying the new code
 */
async function migrateRemovePortsFromIps() {
    console.log("🔄 Starting IP migration - removing ports from Node and NodeSnapshot tables...\n");

    try {
        // Use a transaction to ensure atomicity
        await db.$transaction(async (tx) => {
            // Step 1: First, identify duplicate IPs in Node table
            console.log("📝 Step 1: Identifying duplicate IPs in Node table...");

            const duplicates: any = await tx.$queryRaw`
                SELECT 
                    split_part(ip, ':', 1) as clean_ip,
                    COUNT(*) as count,
                    array_agg(ip ORDER BY "updatedAt" DESC) as ip_list
                FROM "Node"
                WHERE ip LIKE '%:%'
                GROUP BY split_part(ip, ':', 1)
                HAVING COUNT(*) > 1
            `;

            console.log(`  Found ${duplicates.length} IPs with duplicates`);

            // Step 2: For each duplicate, migrate snapshots to the most recent IP, then delete old IPs
            for (const dup of duplicates) {
                const cleanIp = dup.clean_ip;
                const ipList: string[] = dup.ip_list;
                const keepIp = ipList[0]; // Most recent
                const deleteIps = ipList.slice(1);

                console.log(`  Processing ${cleanIp}: keeping ${keepIp}, migrating ${deleteIps.length} duplicates`);

                // Update snapshots from old IPs to point to the keep IP (before deleting)
                for (const oldIp of deleteIps) {
                    const updateCount = await tx.$executeRaw`
                        UPDATE "NodeSnapshot"
                        SET "nodeIp" = ${keepIp}
                        WHERE "nodeIp" = ${oldIp}
                    `;
                    console.log(`    Migrated ${updateCount} snapshots from ${oldIp} to ${keepIp}`);

                    // Now safe to delete the old node
                    await tx.node.delete({
                        where: { ip: oldIp }
                    });
                }
            }

            // Step 3: Now update remaining Node records to remove ports
            console.log("\n📝 Step 2: Updating Node table to remove ports...");
            const nodeUpdateResult = await tx.$executeRaw`
                UPDATE "Node"
                SET ip = split_part(ip, ':', 1)
                WHERE ip LIKE '%:%'
            `;
            console.log(`  ✅ Updated ${nodeUpdateResult} Node records`);

            // Step 4: Update NodeSnapshot table
            console.log("\n📝 Step 3: Updating NodeSnapshot table...");
            const snapshotUpdateResult = await tx.$executeRaw`
                UPDATE "NodeSnapshot"
                SET "nodeIp" = split_part("nodeIp", ':', 1)
                WHERE "nodeIp" LIKE '%:%'
            `;
            console.log(`  ✅ Updated ${snapshotUpdateResult} NodeSnapshot records`);

            // Step 5: Clean up orphaned snapshots (where nodeIp no longer exists in Node table)
            console.log("\n📝 Step 4: Cleaning up orphaned snapshots...");
            const orphanedResult = await tx.$executeRaw`
                DELETE FROM "NodeSnapshot"
                WHERE "nodeIp" NOT IN (SELECT ip FROM "Node")
            `;
            console.log(`  ✅ Deleted ${orphanedResult} orphaned snapshot records`);

            // Step 6: Verify no IPs with ports remain
            console.log("\n📝 Step 5: Verifying migration...");
            const nodeCount: any = await tx.$queryRaw`
                SELECT COUNT(*) as count FROM "Node" WHERE ip LIKE '%:%'
            `;
            const snapshotCount: any = await tx.$queryRaw`
                SELECT COUNT(*) as count FROM "NodeSnapshot" WHERE "nodeIp" LIKE '%:%'
            `;

            const nodeCountValue = parseInt(nodeCount[0]?.count || '0');
            const snapshotCountValue = parseInt(snapshotCount[0]?.count || '0');

            if (nodeCountValue > 0 || snapshotCountValue > 0) {
                throw new Error(
                    `Migration verification failed! Still found IPs with ports. ` +
                    `Node: ${nodeCountValue}, Snapshot: ${snapshotCountValue}`
                );
            }

            // Step 7: Get final counts
            const finalNodeCount: any = await tx.$queryRaw`
                SELECT COUNT(*) as count FROM "Node"
            `;
            const finalSnapshotCount: any = await tx.$queryRaw`
                SELECT COUNT(*) as count FROM "NodeSnapshot"
            `;

            console.log(`\n  ✅ Final Node count: ${finalNodeCount[0]?.count}`);
            console.log(`  ✅ Final NodeSnapshot count: ${finalSnapshotCount[0]?.count}`);
            console.log("  ✅ Verification passed: All IPs successfully updated to remove ports");
        });

        console.log("\n🎉 Migration completed successfully!");
        console.log("All IP addresses are now in format: X.X.X.X (without port)\n");

    } catch (error: any) {
        console.error("\n❌ Migration failed:", error.message);
        console.error("Stack:", error.stack);
        throw error;
    } finally {
        await db.$disconnect();
    }
}

// Run migration
migrateRemovePortsFromIps().catch((error) => {
    console.error("Fatal error during migration:", error);
    process.exit(1);
});
