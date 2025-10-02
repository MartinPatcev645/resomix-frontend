# Export Setup & Troubleshooting Guide

## Issue Fixed: 404 Not Found for Export Files

### Problem
The export files were being created successfully but returned 404 when accessed via URL.

### Solution
Moved the static file mounting to happen **before** router registration in `main.py` to avoid path conflicts.

---

## Restart the Server

After deploying these changes, **restart your FastAPI server**:

```bash
# Kill the current process
sudo kill 484689  # or whatever your process ID is

# Find and kill by name
ps aux | grep run.py
# Then kill the process

# Restart the server
cd ~/usman/basic_fastapi_server_resomix
source .venv/bin/activate
nohup python run.py &
```

**Verify the fix** - You should see these messages in the logs:
```
Created exports directory for static serving: /path/to/exports
Mounted /exports static files from: /path/to/exports
```

---

## Test Export Functionality

```bash
# 1. Test export endpoint
curl -X POST "https://bserver.resomix.com/admin/feedback/export?api_key=your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "all",
    "sort_by": "submitted_at",
    "sort_order": "desc"
  }'

# Response should include:
# {
#   "success": true,
#   "download_url": "https://bserver.resomix.com/exports/feedback_export_YYYYMMDD_HHMMSS_xxxxx.csv",
#   ...
# }

# 2. Test file access (use the URL from response)
curl -I "https://bserver.resomix.com/exports/feedback_export_20251002_050211_b11e4199.csv"

# Should return: HTTP/1.1 200 OK
# (Not 404 anymore!)
```

---

## Cleanup Old Export Files

### Manual Cleanup

```bash
# Test first (dry run - doesn't actually delete)
python scripts/cleanup_exports.py --dry-run

# Actually delete files older than 24 hours
python scripts/cleanup_exports.py

# Delete files older than 12 hours
python scripts/cleanup_exports.py --max-age 12
```

### Automatic Cleanup via Cron

Set up a cron job to automatically clean up old exports daily:

```bash
# Edit crontab
crontab -e

# Add this line to run cleanup daily at 2 AM
0 2 * * * cd /home/alwyzon/usman/basic_fastapi_server_resomix && /home/alwyzon/usman/basic_fastapi_server_resomix/.venv/bin/python scripts/cleanup_exports.py >> logs/cleanup.log 2>&1

# Or run every 6 hours
0 */6 * * * cd /home/alwyzon/usman/basic_fastapi_server_resomix && /home/alwyzon/usman/basic_fastapi_server_resomix/.venv/bin/python scripts/cleanup_exports.py >> logs/cleanup.log 2>&1
```

### Verify Cron Job

```bash
# List your cron jobs
crontab -l

# Check cleanup logs
tail -f logs/cleanup.log
```

---

## Quick Reference Commands

### Server Management
```bash
# Check if server is running
ps aux | grep run.py

# Kill server
sudo kill <PID>

# Start server
cd ~/usman/basic_fastapi_server_resomix
source .venv/bin/activate
nohup python run.py &

# Check logs
tail -f nohup.out
```

### Export Files Management
```bash
# List export files
ls -lh exports/

# Count export files
ls exports/ | wc -l

# Check disk usage
du -sh exports/

# Manually delete old files (older than 1 day)
find exports/ -name "feedback_export_*.csv" -type f -mtime +1 -delete

# Delete all export files (BE CAREFUL!)
rm -f exports/feedback_export_*.csv
```

### Test Export Download
```bash
# Get an export URL
curl -X POST "https://bserver.resomix.com/admin/feedback/export?api_key=your_key" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.download_url'

# Download the file
wget "https://bserver.resomix.com/exports/feedback_export_YYYYMMDD_HHMMSS_xxxxx.csv"

# Or with curl
curl -O "https://bserver.resomix.com/exports/feedback_export_YYYYMMDD_HHMMSS_xxxxx.csv"
```

---

## Monitoring

### Check Export Directory Size
```bash
# Size of exports directory
du -sh exports/

# Number of files and total size
echo "Files: $(ls exports/ | wc -l)"
du -sh exports/ | awk '{print "Size: " $1}'
```

### Watch for New Exports
```bash
# Watch exports directory in real-time
watch -n 2 'ls -lth exports/ | head -10'
```

### Check Server Logs for Export Operations
```bash
# Grep for export operations
grep "admin_export_feedback" nohup.out | tail -20

# Watch export requests in real-time
tail -f nohup.out | grep "admin_export_feedback"
```

---

## Troubleshooting

### Issue: Still Getting 404

**Check 1**: Verify static mount is working
```bash
# Restart server and check logs
grep "Mounted /exports" nohup.out
```

**Check 2**: Verify file permissions
```bash
ls -la exports/
# Should show read permissions for files
```

**Check 3**: Try accessing directly via filesystem
```bash
# Check if files exist
ls -l exports/feedback_export_*.csv

# Check file permissions
stat exports/feedback_export_20251002_050211_b11e4199.csv
```

### Issue: Cleanup Not Working

**Check 1**: Test manually
```bash
python scripts/cleanup_exports.py --dry-run
```

**Check 2**: Check cron logs
```bash
grep CRON /var/log/syslog | tail -20
```

**Check 3**: Run with full path
```bash
/home/alwyzon/usman/basic_fastapi_server_resomix/.venv/bin/python \
  /home/alwyzon/usman/basic_fastapi_server_resomix/scripts/cleanup_exports.py
```

---

## Security Notes

1. **File Access**: Export files are publicly accessible via URL (no authentication required for download)
   - Files expire after 24 hours (recommended)
   - Consider implementing signed URLs for production

2. **Cleanup**: Set up automated cleanup to prevent disk space issues

3. **Rate Limiting**: Consider adding rate limiting to export endpoint to prevent abuse

---

## Summary

✅ **Fixed**: Static file serving for exports  
✅ **Added**: Automated cleanup script  
✅ **Added**: Cron job setup instructions  

**Next Steps**:
1. Restart the server
2. Test export and download
3. Set up cron job for cleanup 