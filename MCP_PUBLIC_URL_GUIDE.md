# MCP Public URL Configuration Guide

## Overview

The `MCP_PUBLIC_URL` environment variable allows you to configure the publicly accessible URL for the MCP server. This is used to generate the correct client configuration JSON for MCP-compatible IDEs (Claude Code, Cursor, Windsurf, etc.).

## Why This Feature Exists

### The Problem

When Archon is deployed on Kubernetes or behind a reverse proxy, the MCP server needs to provide client configuration with the **publicly accessible domain**, not `localhost`.

**Before this feature:**
```json
{
  "mcpServers": {
    "archon": {
      "url": "http://localhost:8051/mcp"  ← ❌ Doesn't work from external machines!
    }
  }
}
```

**After this feature:**
```json
{
  "mcpServers": {
    "archon": {
      "url": "http://archon.automatizase.com.br:8051/mcp"  ← ✅ Works from anywhere!
    }
  }
}
```

## Configuration

### Format

The `MCP_PUBLIC_URL` variable accepts the following formats:

```bash
# With explicit port
MCP_PUBLIC_URL="archon.automatizase.com.br:8051"

# Domain only (port will be inferred from ARCHON_MCP_PORT)
MCP_PUBLIC_URL="archon.automatizase.com.br"

# Development (default)
MCP_PUBLIC_URL="localhost:8051"
```

### Docker Compose

Edit your `.env` file:

```bash
# MCP Public URL Configuration
# Used to generate client configuration JSON for Claude Code, Cursor, etc.
MCP_PUBLIC_URL=localhost:8051  # Change to your domain for production
```

Or export in your shell:

```bash
export MCP_PUBLIC_URL="archon.yourdomain.com:8051"
docker compose up -d
```

### Kubernetes

Edit `k8s-manifests-complete.yaml` - **ConfigMap section:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: archon-config
  namespace: archon
data:
  # ... other configs ...

  # MCP Public URL - CHANGE THIS TO YOUR DOMAIN!
  MCP_PUBLIC_URL: "archon.automatizase.com.br:8051"  # ← UPDATE THIS
```

Then apply:

```bash
kubectl apply -f k8s-manifests-complete.yaml
kubectl rollout restart deployment/archon-server -n archon
```

## How It Works

### Backend (Python)

**File:** `python/src/server/api_routes/mcp_api.py`

The `/api/mcp/config` endpoint reads `MCP_PUBLIC_URL` and uses it to generate the configuration:

```python
# Get MCP public URL from environment
mcp_public_url = os.getenv("MCP_PUBLIC_URL")

if mcp_public_url:
    # Parse to extract host and port
    if ":" in mcp_public_url:
        host, port_str = mcp_public_url.rsplit(":", 1)
        port = int(port_str)
    else:
        host = mcp_public_url
        port = int(os.getenv("ARCHON_MCP_PORT", "8051"))
else:
    # Fallback to localhost
    host = "localhost"
    port = 8051

config = {
    "host": host,
    "port": port,
    "transport": "streamable-http"
}
```

### Frontend (React)

**File:** `archon-ui-main/src/features/mcp/components/McpConfigSection.tsx`

The frontend fetches the config and generates IDE-specific JSON:

```typescript
// For Claude Code
{
  "name": "archon",
  "transport": "http",
  "url": `http://${config.host}:${config.port}/mcp`
}

// For Cursor
{
  "mcpServers": {
    "archon": {
      "url": `http://${config.host}:${config.port}/mcp`
    }
  }
}

// For Windsurf
{
  "mcpServers": {
    "archon": {
      "serverUrl": `http://${config.host}:${config.port}/mcp`
    }
  }
}

// And so on for all supported IDEs...
```

## Deployment Scenarios

### Local Development

```bash
# .env
MCP_PUBLIC_URL=localhost:8051
```

Generated URL: `http://localhost:8051/mcp`

### Production - Direct Access

If MCP is directly accessible on the public internet:

```bash
# Kubernetes ConfigMap
MCP_PUBLIC_URL: "archon.mycompany.com:8051"
```

Generated URL: `http://archon.mycompany.com:8051/mcp`

### Production - Behind Reverse Proxy

If MCP is behind Nginx/Traefik on standard HTTP port:

```bash
# Kubernetes ConfigMap
MCP_PUBLIC_URL: "mcp.mycompany.com:80"
# Or if reverse proxy handles port mapping:
MCP_PUBLIC_URL: "mcp.mycompany.com"  # Port inferred from ARCHON_MCP_PORT
```

Generated URL: `http://mcp.mycompany.com/mcp`

### Production - HTTPS with Custom Port

```bash
# Note: Frontend still generates http:// URLs
# Your reverse proxy should handle HTTPS termination
MCP_PUBLIC_URL: "archon.mycompany.com:443"
```

**Important:** The MCP protocol uses HTTP URLs even when behind HTTPS. Your reverse proxy or load balancer should handle SSL termination.

## Verification

### 1. Check Backend Config Endpoint

```bash
curl http://localhost:8181/api/mcp/config | jq
```

Expected output:

```json
{
  "host": "archon.automatizase.com.br",
  "port": 8051,
  "transport": "streamable-http",
  "model_choice": "gpt-4o-mini"
}
```

### 2. Check Frontend MCP Page

1. Open Archon UI: `http://localhost:3737`
2. Navigate to MCP page
3. Select an IDE (e.g., Claude Code)
4. Verify the generated command/JSON contains your domain:

```bash
# Should show:
claude mcp add --transport http archon http://archon.automatizase.com.br:8051/mcp
```

### 3. Test from External Machine

From another machine, try the MCP connection:

```bash
curl http://archon.automatizase.com.br:8051/health
```

Should return:

```json
{
  "status": "ok",
  "version": "..."
}
```

## Troubleshooting

### Problem: Still showing localhost

**Check:**
1. Is `MCP_PUBLIC_URL` set in ConfigMap?
   ```bash
   kubectl get configmap archon-config -n archon -o yaml | grep MCP_PUBLIC_URL
   ```

2. Did you restart the server deployment?
   ```bash
   kubectl rollout restart deployment/archon-server -n archon
   ```

3. Check server logs:
   ```bash
   kubectl logs -f deployment/archon-server -n archon | grep MCP_PUBLIC_URL
   ```

   Should see:
   ```
   Using MCP_PUBLIC_URL - host=archon.automatizase.com.br, port=8051
   ```

### Problem: Port not included in URL

**Solution:** Explicitly include the port in `MCP_PUBLIC_URL`:

```bash
# Instead of:
MCP_PUBLIC_URL="archon.mycompany.com"

# Use:
MCP_PUBLIC_URL="archon.mycompany.com:8051"
```

### Problem: Can't connect from IDE

**Check:**
1. **Firewall:** Is port 8051 open?
   ```bash
   telnet archon.automatizase.com.br 8051
   ```

2. **MCP Service:** Is it running?
   ```bash
   kubectl get pods -n archon | grep mcp
   ```

3. **Network Policy:** Do you have network policies blocking ingress?
   ```bash
   kubectl get networkpolicies -n archon
   ```

## Security Considerations

### 1. MCP Exposes Read/Write Access

MCP tools can:
- Search and read your knowledge base
- Create/update/delete projects and tasks
- Execute searches
- Modify data in Supabase

**Recommendation:**
- Use authentication (future feature)
- Restrict access via firewall/network policies
- Don't expose MCP publicly without authentication

### 2. No Built-in Authentication (Yet)

Currently, anyone who can reach `http://your-domain:8051/mcp` can use your MCP server.

**Mitigation strategies:**
- Use Kubernetes Network Policies to restrict access
- Use VPN or private networking
- Put MCP behind a reverse proxy with authentication
- Use IP allowlisting on your firewall

### 3. HTTPS Considerations

MCP protocol uses `http://` URLs even when behind HTTPS. This is normal - your reverse proxy handles SSL termination.

**Example setup:**
```
User → HTTPS (443) → Reverse Proxy → HTTP (8051) → MCP Pod
```

## Advanced Configuration

### Multiple Environments

Use different ConfigMaps per environment:

```bash
# dev-config.yaml
MCP_PUBLIC_URL: "localhost:8051"

# staging-config.yaml
MCP_PUBLIC_URL: "staging.archon.mycompany.com:8051"

# prod-config.yaml
MCP_PUBLIC_URL: "archon.mycompany.com:8051"
```

### Custom Domain with Ingress

If using Kubernetes Ingress:

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: archon-mcp-ingress
  namespace: archon
spec:
  rules:
  - host: mcp.mycompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: archon-mcp-service
            port:
              number: 8051
```

Then set:
```yaml
# ConfigMap
MCP_PUBLIC_URL: "mcp.mycompany.com:80"  # or just "mcp.mycompany.com"
```

## Related Configuration

### ARCHON_HOST (Legacy)

The old `ARCHON_HOST` variable is still used as a fallback if `MCP_PUBLIC_URL` is not set:

```bash
# Legacy mode (still works)
ARCHON_HOST=localhost
ARCHON_MCP_PORT=8051

# New mode (preferred)
MCP_PUBLIC_URL=localhost:8051
```

**Migration path:**
1. Add `MCP_PUBLIC_URL` with your production domain
2. Keep `ARCHON_HOST` for backwards compatibility
3. Eventually, `ARCHON_HOST` may be removed

### MCP_SERVICE_URL (Internal)

**Do not confuse** `MCP_PUBLIC_URL` with `MCP_SERVICE_URL`:

- `MCP_PUBLIC_URL`: **External** URL for client configuration (e.g., `archon.mycompany.com:8051`)
- `MCP_SERVICE_URL`: **Internal** K8s DNS for server-to-MCP communication (e.g., `http://archon-mcp-service.archon.svc.cluster.local:8051`)

## Summary

**Quick Setup:**

1. **Edit ConfigMap:**
   ```yaml
   MCP_PUBLIC_URL: "your-domain.com:8051"
   ```

2. **Apply and restart:**
   ```bash
   kubectl apply -f k8s-manifests-complete.yaml
   kubectl rollout restart deployment/archon-server -n archon
   ```

3. **Verify:**
   ```bash
   curl http://localhost:8181/api/mcp/config | jq .host
   # Should return: "your-domain.com"
   ```

4. **Test from IDE:**
   - Open Archon UI → MCP page
   - Copy configuration for your IDE
   - Verify URL contains your domain

**Files Modified:**
- ✅ `python/src/server/api_routes/mcp_api.py` - Backend logic
- ✅ `k8s-manifests-complete.yaml` - K8s ConfigMap and deployment
- ✅ `docker-compose.yml` - Docker Compose environment
- ✅ `.env.example` - Environment variable documentation
- ✅ `K8S_COMPLETE_ADJUSTMENTS.md` - Deployment guide

**Support:**
- GitHub Issues: https://github.com/your-repo/archon/issues
- Documentation: https://docs.archon.yourdomain.com
