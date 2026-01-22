# Fix for 413 Content Too Large Error

## Problem
When uploading large files (especially for news media), you may encounter a `413 Content Too Large` error. This happens because nginx (or your reverse proxy) has a default limit on request body size (usually 1MB).

## Solution

### 1. Backend Code Changes (Already Applied)
✅ The backend code has been updated to:
- Accept files up to 1GB via multer configuration
- Increased Express body parser limits to 1GB
- Added `MAX_MEDIA_SIZE` environment variable (defaults to 1GB)

### 2. Nginx Configuration (REQUIRED)

You **must** update your nginx configuration to allow large uploads. The backend code changes alone are not sufficient if nginx is rejecting the request before it reaches the application.

#### Option A: Update Existing Nginx Config

Add these directives to your nginx server block for `api.tgcalabriareport.com`:

```nginx
server {
    listen 443 ssl http2;
    server_name api.tgcalabriareport.com;

    # CRITICAL: Increase client body size limit to 1GB
    client_max_body_size 1G;
    
    # Increase buffer sizes
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;

    # Increase timeouts for large uploads
    client_body_timeout 300s;
    client_header_timeout 300s;
    send_timeout 300s;
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;

    # Disable buffering for large uploads
    proxy_request_buffering off;
    proxy_buffering off;

    location /api/ {
        proxy_pass http://localhost:3001;  # Adjust port if needed
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Disable buffering
        proxy_request_buffering off;
        proxy_buffering off;
        
        # Timeouts
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

#### Option B: Use the Provided Example Config

1. Copy `nginx.conf.example` to your nginx sites-available directory:
   ```bash
   sudo cp backend/nginx.conf.example /etc/nginx/sites-available/api.tgcalabriareport.com
   ```

2. Update the upstream server port if needed (default is 3001)

3. Update SSL certificate paths

4. Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/api.tgcalabriareport.com /etc/nginx/sites-enabled/
   ```

5. Test the configuration:
   ```bash
   sudo nginx -t
   ```

6. Reload nginx:
   ```bash
   sudo systemctl reload nginx
   ```

### 3. Verify the Fix

After updating nginx:

1. **Test with a large file upload** (try uploading a file > 50MB)
2. **Check nginx error logs** if issues persist:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```
3. **Check backend logs** to ensure requests are reaching the application:
   ```bash
   # In your backend directory
   npm run dev  # or your production command
   ```

### 4. Environment Variable (Optional)

You can customize the max upload size by setting the `MAX_MEDIA_SIZE` environment variable in your `.env` file:

```env
MAX_MEDIA_SIZE=1073741824  # 1GB in bytes (default)
# Or for 2GB:
MAX_MEDIA_SIZE=2147483648
```

## Important Notes

- **The nginx configuration is REQUIRED** - without it, nginx will reject large uploads before they reach your Express application
- The `client_max_body_size` directive must be set in the `server` block, not just the `location` block
- After changing nginx config, always test with `nginx -t` before reloading
- If using a load balancer or CDN, you may need to configure upload limits there as well

## Troubleshooting

### Still getting 413 errors?

1. **Verify nginx config is loaded:**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

2. **Check which nginx config is active:**
   ```bash
   sudo nginx -T | grep client_max_body_size
   ```

3. **Check if there's a global limit:**
   ```bash
   sudo grep -r "client_max_body_size" /etc/nginx/
   ```

4. **Verify backend is running:**
   ```bash
   curl http://localhost:3001/health
   ```

5. **Check backend logs** for multer errors (these would be different from 413)

### CORS Errors

If you see CORS errors after fixing the 413 error, ensure:
- CORS is properly configured in `backend/src/app.ts` (already done)
- The frontend origin is allowed
- Preflight OPTIONS requests are handled correctly
