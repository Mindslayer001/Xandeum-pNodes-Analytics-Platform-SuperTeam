# Error Logging System

## Overview
Created a comprehensive error logging system for the Xandeum cron jobs and API operations. All errors are now tracked in the database for analysis and monitoring.

## Database Schema

### ErrorLog Table
```prisma
model ErrorLog {
  id        Int      @id @default(autoincrement())
  source    String   // e.g., "cron/assembler", "api/nodes"
  phase     String   // e.g., "fetch", "upsert", "snapshot", "validation"
  nodeId    String?  // IP or identifier of the node that caused error
  error     String   // Error message
  details   String?  // Additional error details or stack trace
  timestamp DateTime @default(now())

  @@index([source, timestamp])
  @@index([timestamp])
}
```

## Cron Job Integration

The `cron/assembler` API now logs all errors to the database:

### Error Phases Tracked
1. **fetch** - Errors when fetching nodes from RPC
2. **validation** - Node validation errors (missing IP, etc.)
3. **upsert** - Database upsert errors for individual nodes
4. **snapshot** - Errors when creating node snapshots
5. **critical** - Unhandled critical failures

### Example Error Log Entry
```json
{
  "id": 1,
  "source": "cron/assembler",
  "phase": "upsert",
  "nodeId": "192.168.1.1:6000",
  "error": "Unique constraint failed on the constraint: `Node_pkey`",
  "details": "Error: Unique constraint failed...\n    at PrismaClient...",
  "timestamp": "2025-12-26T00:00:00.000Z"
}
```

## API Endpoints

### View Error Logs
**GET** `/api/errors`

Query parameters:
- `limit` (default: 100) - Number of errors to return
- `source` - Filter by source (e.g., "cron/assembler")
- `phase` - Filter by phase (e.g., "upsert")

**Examples:**
```bash
# Get last 100 errors
curl http://localhost:3001/api/errors

# Get errors from cron/assembler
curl http://localhost:3001/api/errors?source=cron/assembler

# Get only upsert errors
curl http://localhost:3001/api/errors?phase=upsert

# Get last 50 fetch errors
curl http://localhost:3001/api/errors?phase=fetch&limit=50
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "errors": [
    {
      "id": 1,
      "source": "cron/assembler",
      "phase": "upsert",
      "nodeId": "192.168.1.1:6000",
      "error": "Database error",
      "details": "Stack trace...",
      "timestamp": "2025-12-26T00:00:00.000Z"
    }
  ],
  "stats": [
    {
      "source": "cron/assembler",
      "phase": "upsert",
      "count": 5
    }
  ]
}
```

## Testing

### Check Error Logs via Script
```bash
npx tsx scripts/check-errors.ts
```

This will display:
- Last 10 errors with details
- Statistics grouped by source and phase

### Manual Testing
To test the error logging, you can:

1. Trigger the cron job manually:
```bash
curl -X POST http://localhost:3001/api/cron/assembler
```

2. View the errors:
```bash
curl http://localhost:3001/api/errors
```

## Benefits

✅ **Persistent Error Tracking** - All errors are stored in the database  
✅ **Error Analysis** - Query and analyze error patterns over time  
✅ **Monitoring** - Easy to build dashboards and alerts based on error logs  
✅ **Debugging** - Stack traces and details help troubleshoot issues  
✅ **Non-Blocking** - Error logging doesn't stop the cron job execution  
✅ **Indexed** - Fast queries with indexes on source and timestamp  

## Notes

- Errors are logged using "fire and forget" pattern (`.catch(() => {})`) for non-critical paths to avoid blocking execution
- Critical errors use `await` to ensure they're logged before returning error response
- Stack traces are only included in development mode for API responses but always stored in the database
- The cron job continues processing even if individual nodes fail, ensuring maximum resilience
