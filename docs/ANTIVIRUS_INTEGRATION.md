# Antivirus Integration Guide

## Overview

This document describes the ClamAV antivirus integration implemented in the Resomix FastAPI server to protect against malicious file uploads.

## Architecture

### Security Flow

The file upload security validation follows this order:

1. **File size check** - Verify file is within size limits (100MB)
2. **Empty file check** - Ensure file is not empty
3. **🔒 Antivirus scan** - Scan for malware using ClamAV (NEW)
4. **FFmpeg validation** - Validate audio format using ffprobe
5. **Metadata extraction** - Extract audio metadata using Mutagen
6. **Database upload** - Store track information
7. **Similarity processing** - Process for similarity matching

### Why Antivirus Scan Before FFmpeg?

- **Security first**: Antivirus scanning happens before any external tools (ffprobe, mutagen) touch the file
- **Privilege separation**: Prevents potentially malicious files from being processed by high-privilege operations
- **Early rejection**: Infected files are rejected immediately after basic validation
- **Attack surface reduction**: Minimizes exposure to exploit attempts through crafted audio files

## Implementation

### AntivirusService

Location: `app/services/antivirus_service.py`

**Features:**
- Dual-mode scanning: clamd streaming (preferred) and clamscan subprocess (fallback)
- No disk writes when using clamd streaming (memory-only scanning)
- Automatic method selection based on availability
- Comprehensive error handling and logging
- Timeout protection for subprocess scans

**Methods:**
- `is_clamd_available()` - Check if clamd daemon is running
- `is_clamscan_available()` - Check if clamscan command is available
- `scan_bytes(file_bytes, filename)` - Main scanning method

**Return Format:**
```python
{
    "success": bool,      # True if scan completed
    "clean": bool,        # True if no threats found
    "threat": str,        # Name of detected threat (if any)
    "method": str,        # "clamd" or "clamscan"
    "error": str,         # Error message (if scan failed)
    "filename": str       # Original filename
}
```

### Integration Points

#### Similarity Upload Controller

Location: `app/controllers/similarity_controller.py`

**Integration:**
- Added after empty file check (line ~170)
- Before any FFmpeg or Mutagen operations
- Logs all scan results with correlation IDs
- Returns 415 error for detected threats
- Returns 500 error for scan failures

**Logging Categories:**
- `category="SECURITY"` for all antivirus-related logs
- `action="antivirus_scan_passed"` for clean files
- `action="malware_detected"` for threats
- `action="antivirus_scan_failed"` for scan errors

## Server Setup

### Prerequisites

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install clamav clamav-daemon
```

**RedHat/CentOS:**
```bash
sudo yum install clamav clamav-scanner clamav-daemon
```

### Configuration

1. **Update virus definitions:**
   ```bash
   sudo freshclam
   ```

2. **Enable automatic updates:**
   ```bash
   sudo systemctl enable --now clamav-freshclam
   ```

3. **Start clamd daemon:**
   ```bash
   sudo systemctl enable --now clamav-daemon
   ```

4. **Verify installation:**
   ```bash
   # Check services
   systemctl status clamav-daemon
   systemctl status clamav-freshclam
   
   # Check socket
   ls -l /var/run/clamav/clamd.ctl
   
   # Test with EICAR
   printf '%s' 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > /tmp/eicar.txt
   clamdscan /tmp/eicar.txt
   ```

### Python Dependencies

Add to `requirements.txt`:
```
clamd==1.0.2
```

Install:
```bash
pip install clamd==1.0.2
```

## Testing

### Test Script

Run the provided test script:
```bash
python test_antivirus.py
```

Expected output:
```
======================================================================
ANTIVIRUS SERVICE TEST
======================================================================

1. Checking ClamAV availability...
----------------------------------------------------------------------
   clamd daemon:      ✓ Available
   clamscan command:  ✓ Available

2. Testing with EICAR test virus (should be detected)...
----------------------------------------------------------------------
   Success:    True
   Clean:      False
   Threat:     Win.Test.EICAR_HDB-1
   Method:     clamd
   Error:      N/A
   ✓ PASS: Malware detected correctly: Win.Test.EICAR_HDB-1

3. Testing with clean file (should pass)...
----------------------------------------------------------------------
   Success:    True
   Clean:      True
   Threat:     N/A
   Method:     clamd
   Error:      N/A
   ✓ PASS: Clean file passed scan

4. Testing with empty file (should fail gracefully)...
----------------------------------------------------------------------
   Success:    False
   Clean:      False
   Error:      Empty file provided for scanning
   ✓ PASS: Empty file handled correctly

======================================================================
TEST COMPLETE
======================================================================
```

### Manual API Testing

1. **Test with clean audio file:**
   ```bash
   curl -X POST "http://localhost:8000/api/similarity/get_similarity/" \
     -H "X-API-Key: your-api-key" \
     -F "file=@clean_audio.mp3"
   ```

2. **Test with EICAR test file:**
   ```bash
   printf '%s' 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > /tmp/eicar.txt
   curl -X POST "http://localhost:8000/api/similarity/get_similarity/" \
     -H "X-API-Key: your-api-key" \
     -F "file=@/tmp/eicar.txt"
   ```
   
   Expected response:
   ```json
   {
     "success": false,
     "error": "The uploaded file contains malicious content and has been rejected for security reasons."
   }
   ```

## Performance Considerations

### clamd Streaming (Preferred)
- **Speed**: ~5-10ms for typical audio files
- **Memory**: Scans in memory, no disk I/O
- **Scalability**: Excellent for high-volume uploads
- **Setup**: Requires clamd daemon running

### clamscan Fallback
- **Speed**: ~50-200ms (includes temp file write)
- **Memory**: Writes temp file to disk
- **Scalability**: Adequate for moderate traffic
- **Setup**: Only requires clamscan binary

### Optimization Tips

1. **Keep virus definitions updated** but avoid updating during peak traffic
2. **Monitor clamd memory usage** (typically 1-1.5GB)
3. **Set reasonable StreamMaxLength** in clamd.conf (e.g., 110MB for 100MB uploads)
4. **Use clamd local socket** instead of TCP for better performance
5. **Consider rate limiting** upload endpoints

## Monitoring & Alerts

### Log Analysis

Search for security events:
```bash
# Malware detections
grep "malware_detected" logs/*.log

# Scan failures
grep "antivirus_scan_failed" logs/*.log

# Clean scans
grep "antivirus_scan_passed" logs/*.log
```

### Metrics to Track

- Number of scans per hour
- Malware detection rate
- Scan duration (should be < 100ms with clamd)
- Scan failure rate
- Method used (clamd vs clamscan)

### Alerting

Set up alerts for:
- Multiple malware detections from same IP (potential attack)
- High scan failure rate (ClamAV service issues)
- Clamd unavailable (service down)

## Troubleshooting

### Common Issues

#### 1. clamd not connecting
```bash
# Check if daemon is running
systemctl status clamav-daemon

# Check socket permissions
ls -l /var/run/clamav/clamd.ctl

# Add user to clamav group
sudo usermod -aG clamav $USER

# Restart your shell/service
```

#### 2. Virus definitions outdated
```bash
# Check last update
sudo freshclam --version

# Manual update
sudo freshclam

# Check automatic updates
systemctl status clamav-freshclam
```

#### 3. Memory issues
```bash
# Check clamd memory usage
ps aux | grep clamd

# Adjust StreamMaxLength in /etc/clamav/clamd.conf
StreamMaxLength 110M

# Restart daemon
sudo systemctl restart clamav-daemon
```

#### 4. Permission errors
```bash
# Ensure socket is accessible
sudo chmod 666 /var/run/clamav/clamd.ctl

# Or add to group
sudo usermod -aG clamav alwyzon
```

## Security Best Practices

1. **Keep ClamAV updated**: Run freshclam daily via cron/systemd timer
2. **Monitor detection logs**: Regular review of detected threats
3. **Rate limiting**: Implement rate limits on upload endpoints
4. **IP blocking**: Block IPs with repeated malware upload attempts
5. **Sandboxing**: Run clamd with minimal privileges
6. **Backup scanning method**: Maintain both clamd and clamscan availability
7. **File quarantine**: Consider saving detected malware samples for analysis
8. **Incident response**: Have a process for handling detected threats

## Future Enhancements

Potential improvements:

1. **Multi-AV scanning**: Add secondary AV engine for critical uploads
2. **Heuristic analysis**: Enable advanced detection methods
3. **File quarantine**: Store malware samples for security analysis
4. **Async scanning**: Offload scans to background workers for large files
5. **Scan cache**: Cache scan results by file hash to avoid re-scanning
6. **Metrics dashboard**: Real-time monitoring of scan statistics
7. **WAF integration**: Coordinate with web application firewall

## References

- [ClamAV Documentation](https://docs.clamav.net/)
- [python-clamd Documentation](https://pypi.org/project/clamd/)
- [EICAR Test File](https://www.eicar.org/download-anti-malware-testfile/)
- [OWASP File Upload Security](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)

## Support

For issues or questions:
- Email: usman.naeem2212@gmail.com
- Check logs in `logs/` directory
- Review ClamAV logs: `/var/log/clamav/`

---

**Version**: 1.0.0  
**Last Updated**: October 18, 2025  
**Author**: Muhammad Usman Naeem

