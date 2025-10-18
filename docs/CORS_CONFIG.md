# CORS Configuration Guide

## Overview

The application now uses **explicit allowed origins** for CORS instead of broad regex patterns. This is more secure, especially when `allow_credentials=True` (which is needed for cookies and authentication headers).

## Configuration Files

### 1. **config.py** (Updated)
- Added explicit `allowed_origins_production` and `allowed_origins_development` lists
- Added specific CORS headers, methods, and expose headers
- Added `cors_max_age` for preflight caching (24 hours)
- Kept legacy regex support as fallback (`use_cors_regex=False` by default)

### 2. **cors.py** (Updated)
- Now uses explicit origin lists instead of regex
- Exposes headers needed for HLS/media streaming (`Content-Length`, `Content-Range`, etc.)
- Caches preflight requests for 24 hours
- Logs CORS mode and allowed origins on startup

## Default Configuration

### Production Mode (when `RESOMIX_USE_DEVELOPMENT_CORS=false`)
```python
allowed_origins_production = [
    "https://resomix.com",
    "https://beta.resomix.com", 
    "https://www.resomix.com",
]
```

### Development Mode (when `RESOMIX_USE_DEVELOPMENT_CORS=true`)
```python
allowed_origins_development = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8001",
]
```

## Environment Variable Control

### Basic Setup (Recommended)

Add to your `.env` file:

```bash
# CORS Mode
RESOMIX_USE_DEVELOPMENT_CORS=false  # Set to 'true' for dev, 'false' for prod
```

That's it! The defaults are secure and should work for most cases.

### Advanced: Custom Origins (Optional)

If you need to add more origins, you currently need to:
1. Edit `config.py` directly
2. Add to the appropriate list (`allowed_origins_production` or `allowed_origins_development`)
3. Restart the application

**Future Enhancement:** Add environment variable support for custom origins.

### Advanced: Regex Mode (Not Recommended)

If you absolutely need wildcard subdomain matching (e.g., `*.resomix.com`):

```bash
# In .env - NOT RECOMMENDED with credentials=True
RESOMIX_USE_CORS_REGEX=true
```

This will use the regex pattern: `^https://([a-z0-9-]+\.)*resomix\.com$`

⚠️ **Warning:** Using regex with `allow_credentials=True` can be less secure. Prefer explicit origins.

## CORS Headers Configured

### Allowed Methods
```python
["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
```

### Allowed Headers (for requests)
```python
["Authorization", "Content-Type", "X-Requested-With", "X-Api-Key"]
```

### Exposed Headers (for responses - needed for HLS/media)
```python
["Content-Length", "Content-Range", "Accept-Ranges", "Content-Disposition"]
```

### Other Settings
- **Credentials:** `True` (allows cookies/auth headers)
- **Max Age:** `86400` seconds (24 hours preflight cache)

## Testing CORS

### 1. Check Startup Logs
When you start the app, you should see:
```
CORS: production mode with 3 allowed origins
CORS origins: https://resomix.com, https://beta.resomix.com, https://www.resomix.com
```

Or in development:
```
CORS: development mode with 6 allowed origins
CORS origins: http://localhost:3000, http://localhost:8000, ...
```

### 2. Test Preflight Request
```bash
curl -X OPTIONS https://bserver.resomix.com/api/tracks \
  -H "Origin: https://resomix.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization,Content-Type" \
  -v
```

You should see:
```
Access-Control-Allow-Origin: https://resomix.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With, X-Api-Key
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
Vary: Origin
```

### 3. Test from Browser Console
```javascript
fetch('https://bserver.resomix.com/api/tracks', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  }
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## CDN / Cloudflare Notes

### Vary: Origin Header
Starlette's CORSMiddleware automatically adds `Vary: Origin` when needed. This is critical for Cloudflare to cache responses correctly based on the requesting origin.

### No CORS Needed on Cloudflare Pages
Your static frontend (Cloudflare Pages) does NOT need CORS headers. Only your API backend needs them.

### Media/HLS Endpoints
The `expose_headers` configuration allows browsers to read `Content-Length`, `Content-Range`, etc., which is necessary for:
- HLS streaming
- Range requests
- Progressive downloads
- Media controls

## Migration from Old Config

### Old Way (Broad Regex)
```python
allow_origin_regex=r"^https?://.*"  # Too permissive!
```

### New Way (Explicit Origins)
```python
allow_origins=[
    "https://resomix.com",
    "https://beta.resomix.com"
]
```

## Security Benefits

✅ **No wildcard origins** - Prevents unauthorized domains from accessing your API  
✅ **Explicit origin validation** - Only listed domains can make credentialed requests  
✅ **Specific headers** - Reduces attack surface by limiting allowed headers  
✅ **Preflight caching** - Reduces overhead with 24-hour cache  
✅ **Media header exposure** - Enables proper HLS/range request handling  
✅ **Vary: Origin** - Proper CDN caching behavior  

## Troubleshooting

### CORS Error in Browser
```
Access to fetch at 'https://bserver.resomix.com' from origin 'https://app.resomix.com' 
has been blocked by CORS policy
```

**Solution:** Add `https://app.resomix.com` to the appropriate origins list in `config.py`

### Preflight Not Caching
Check that the response includes:
```
Access-Control-Max-Age: 86400
```

### Media/HLS Not Working
Ensure `expose_headers` includes:
```
Content-Length, Content-Range, Accept-Ranges, Content-Disposition
```

### Credentials Not Working
Verify:
1. `allow_credentials=True` in middleware
2. Origin is in the explicit allowed list (not using wildcard/regex)
3. Frontend sends `credentials: 'include'` in fetch

## Quick Checklist for Production

- [ ] Set `RESOMIX_USE_DEVELOPMENT_CORS=false` in production `.env`
- [ ] Verify `allowed_origins_production` list includes all your frontend domains
- [ ] Test preflight OPTIONS requests from each origin
- [ ] Test actual API calls with credentials from browser
- [ ] Check Nginx is passing `Vary: Origin` header correctly
- [ ] Verify HLS/media streaming works (if applicable)

## Adding New Origins

**For now**, to add a new origin:

1. Edit `/Users/muhammadusmannaeem/Data/projects/Upwork/George/basic_fastapi_server_resomix/app/core/config.py`
2. Find `allowed_origins_production` or `allowed_origins_development`
3. Add your origin to the list:
   ```python
   allowed_origins_production: List[str] = Field(
       default=[
           "https://resomix.com",
           "https://beta.resomix.com",
           "https://www.resomix.com",
           "https://app.resomix.com",  # ← Add new origin here
       ],
       ...
   )
   ```
4. Restart the application

**Future:** Consider adding environment variable support like:
```bash
CORS_ADDITIONAL_ORIGINS=https://app.resomix.com,https://staging.resomix.com
```

