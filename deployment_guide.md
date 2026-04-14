# deployment_guide.md
# Nyaya Platform — Production Deployment Guide

**Target Domain:** `nyai.blackholeinfiverse.com`  
**Backend:** `nyaya-ai-0f02.onrender.com`  
**Stack:** React/Vite on Vercel + FastAPI on Render  
**Last Updated:** 2025-07-14

---

## 1. Infrastructure Overview

```
┌──────────────────────────────────────────────────────────────┐
│  DNS (blackholeinfiverse.com registrar)                      │
│  CNAME  nyai  →  cname.vercel-dns.com                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Vercel CDN                                                  │
│  Domain:  nyai.blackholeinfiverse.com                        │
│  TLS:     Let's Encrypt (auto-provisioned)                   │
│  Build:   npm run build (Vite)                               │
│  Root:    nyaya/frontend/frontend/                           │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS API calls
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Render Web Service                                          │
│  Domain:  nyaya-ai-0f02.onrender.com                         │
│  TLS:     Render-managed (auto-provisioned)                  │
│  Runtime: Python 3.11                                        │
│  Process: uvicorn nyaya.backend.main:app                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

Before deploying, confirm the following are available:

- [ ] GitHub repository access: `https://github.com/hrujulinfiverse/gravitas_UI`
- [ ] Vercel account connected to the GitHub repo
- [ ] Render account connected to the GitHub repo
- [ ] DNS management access for `blackholeinfiverse.com`
- [ ] `HMAC_SECRET_KEY` generated: `openssl rand -hex 32`
- [ ] Node.js 24.x and npm ≥ 9 for local build verification
- [ ] Python 3.11 for local backend verification

---

## 3. Backend Deployment — Render

### 3.1 Create Web Service

1. Log in to [render.com](https://render.com)
2. New → Web Service → Connect GitHub repo `hrujulinfiverse/gravitas_UI`
3. Configure:

| Field | Value |
|---|---|
| Name | `nyaya-backend` |
| Region | Choose closest to your users |
| Branch | `main` |
| Root Directory | `.` (repo root) |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn nyaya.backend.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Starter (or higher for production load) |

### 3.2 Environment Variables

Set these in Render → Environment → Add Environment Variable:

```
ALLOWED_ORIGINS   = https://nyai.blackholeinfiverse.com
HMAC_SECRET_KEY   = <output of: openssl rand -hex 32>
SIGNING_METHOD    = HMAC_SHA256
SIGNING_KEY_ID    = primary-key-2025
HOST              = 0.0.0.0
LOG_LEVEL         = info
```

**Do not set PORT** — Render injects it automatically.

### 3.3 Verify Backend is Live

```bash
curl https://nyaya-ai-0f02.onrender.com/health
# Expected: {"status":"healthy","service":"nyaya-api-gateway"}

curl https://nyaya-ai-0f02.onrender.com/
# Expected: {"service":"Nyaya Legal AI API Gateway","version":"1.0.0",...}
```

### 3.4 Verify CORS is Hardened

```bash
curl -X OPTIONS https://nyaya-ai-0f02.onrender.com/nyaya/query \
  -H "Origin: https://nyai.blackholeinfiverse.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v 2>&1 | grep -i "access-control"

# Must see: access-control-allow-origin: https://nyai.blackholeinfiverse.com
# Must NOT see: access-control-allow-origin: *
```

```bash
# Verify blocked origin
curl -X OPTIONS https://nyaya-ai-0f02.onrender.com/nyaya/query \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -v 2>&1 | grep -i "access-control"

# Must see: no access-control-allow-origin header
```

---

## 4. Frontend Deployment — Vercel

### 4.1 Import Project

1. Log in to [vercel.com](https://vercel.com)
2. Add New → Project → Import from GitHub `hrujulinfiverse/gravitas_UI`
3. Configure:

| Field | Value |
|---|---|
| Framework Preset | Vite |
| Root Directory | `nyaya/frontend/frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js Version | 24.x |

### 4.2 Environment Variables

Set in Vercel → Settings → Environment Variables:

```
VITE_API_URL = https://nyaya-ai-0f02.onrender.com
```

Set for: Production, Preview, Development (all three environments).

**Important:** The key must be `VITE_API_URL`, not `NEXT_PUBLIC_API_URL` or `REACT_APP_API_URL`. Vite only exposes variables prefixed with `VITE_` to the browser bundle.

### 4.3 Add Custom Domain

1. Vercel → Project → Settings → Domains
2. Add domain: `nyai.blackholeinfiverse.com`
3. Vercel will display the required DNS record

### 4.4 Verify Build

After deployment, check the build log for:
- No `VITE_API_URL` undefined warnings
- `dist/` directory created successfully
- No TypeScript or ESLint errors blocking build

---

## 5. DNS Configuration

### 5.1 Add CNAME Record

At your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.) for `blackholeinfiverse.com`:

```
Type    Name    Value                   TTL
CNAME   nyai    cname.vercel-dns.com.   Auto (or 300)
```

**If your registrar does not support CNAME at subdomain level**, use an A record:
```
Type    Name    Value           TTL
A       nyai    76.76.21.21     Auto
```

### 5.2 Verify DNS Propagation

```bash
# Check from your machine (may take 5 min – 48 hours)
nslookup nyai.blackholeinfiverse.com
# Expected: CNAME → cname.vercel-dns.com → Vercel IP

# Or use dig
dig nyai.blackholeinfiverse.com CNAME
```

Use [dnschecker.org](https://dnschecker.org) to verify global propagation.

### 5.3 SSL Certificate

Vercel auto-provisions a Let's Encrypt TLS certificate within ~60 seconds of DNS propagation. No manual action required.

Verify:
```bash
curl -I https://nyai.blackholeinfiverse.com
# Expected: HTTP/2 200, server: Vercel
```

---

## 6. Docker Deployment (Alternative — VPS Path)

Use this path if deploying the backend to a VPS (DigitalOcean, AWS EC2, etc.) instead of Render.

### 6.1 Build and Run

```bash
# From repo root
docker build -t nyaya-backend:prod .

docker run -d \
  --name nyaya-backend \
  --restart unless-stopped \
  -p 8000:8000 \
  -e ALLOWED_ORIGINS=https://nyai.blackholeinfiverse.com \
  -e HMAC_SECRET_KEY=<your-secret> \
  -e SIGNING_METHOD=HMAC_SHA256 \
  -e SIGNING_KEY_ID=primary-key-2025 \
  -e LOG_LEVEL=info \
  nyaya-backend:prod
```

### 6.2 Nginx Reverse Proxy with TLS

Install Nginx and Certbot on the VPS:

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

Create `/etc/nginx/sites-available/nyaya-api`:

```nginx
server {
    listen 80;
    server_name api.nyai.blackholeinfiverse.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.nyai.blackholeinfiverse.com;

    ssl_certificate     /etc/letsencrypt/live/api.nyai.blackholeinfiverse.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.nyai.blackholeinfiverse.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nyaya-api /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.nyai.blackholeinfiverse.com
sudo systemctl reload nginx
```

Update `VITE_API_URL` in Vercel to `https://api.nyai.blackholeinfiverse.com`.

---

## 7. Environment Variable Reference

### Complete Variable Map

| Variable | Where Set | Value | Notes |
|---|---|---|---|
| `VITE_API_URL` | Vercel dashboard | `https://nyaya-ai-0f02.onrender.com` | Must have `VITE_` prefix |
| `ALLOWED_ORIGINS` | Render dashboard | `https://nyai.blackholeinfiverse.com` | Comma-separated for multiple |
| `HMAC_SECRET_KEY` | Render dashboard | `<openssl rand -hex 32>` | Never commit to git |
| `SIGNING_METHOD` | Render dashboard | `HMAC_SHA256` | Fixed value |
| `SIGNING_KEY_ID` | Render dashboard | `primary-key-2025` | Update on key rotation |
| `HOST` | Render dashboard | `0.0.0.0` | Required for container binding |
| `LOG_LEVEL` | Render dashboard | `info` | `debug` for troubleshooting |
| `PORT` | Auto-injected by Render | — | Do not set manually |

### Local Development Overrides

For local development, create `nyaya/backend/.env` (gitignored):

```bash
ALLOWED_ORIGINS=http://localhost:3000,https://nyai.blackholeinfiverse.com
HMAC_SECRET_KEY=local-dev-secret-not-for-production
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=debug
```

For frontend local dev, `nyaya/frontend/frontend/.env.local` (gitignored):

```bash
VITE_API_URL=http://localhost:8000
```

---

## 8. SSL Certificate Details

| Component | Provider | Method | Renewal |
|---|---|---|---|
| `nyai.blackholeinfiverse.com` | Let's Encrypt via Vercel | Auto-provisioned on domain add | Auto-renewed by Vercel |
| `nyaya-ai-0f02.onrender.com` | Let's Encrypt via Render | Auto-provisioned | Auto-renewed by Render |
| VPS path (if used) | Let's Encrypt via Certbot | `certbot --nginx` | `certbot renew` cron |

All certificates use TLS 1.2+ with strong cipher suites. TLS 1.0 and 1.1 are not supported.

---

## 9. Connectivity Checklist

Run through this checklist in order after every deployment:

### Infrastructure

- [ ] `nslookup nyai.blackholeinfiverse.com` resolves to Vercel IP
- [ ] `curl -I https://nyai.blackholeinfiverse.com` returns `HTTP/2 200`
- [ ] No browser certificate warning on `https://nyai.blackholeinfiverse.com`
- [ ] `curl https://nyaya-ai-0f02.onrender.com/health` returns `{"status":"healthy"}`

### CORS

- [ ] OPTIONS preflight from `nyai.blackholeinfiverse.com` returns `Access-Control-Allow-Origin: https://nyai.blackholeinfiverse.com`
- [ ] OPTIONS preflight from `evil.example.com` returns no ACAO header
- [ ] No `Access-Control-Allow-Origin: *` anywhere in response headers

### Pipeline Integrity

- [ ] `POST /nyaya/query` with valid payload returns `metadata.Formatted: true`
- [ ] Response body contains `reasoning_trace.observer_processing.pipeline_stage: "observer_pipeline"`
- [ ] Audit log line for the request shows `"formatted": true, "observer_triggered": true, "schema_valid": true`
- [ ] `POST /nyaya/query` with missing `query` field returns 422 (not 500)
- [ ] `POST /nyaya/query` with `Content-Type: text/plain` returns 400

### Enforcement Paths

- [ ] Seed a trace with confidence 0.92 → `GET /nyaya/enforcement_status` returns `state: "clear"`
- [ ] Seed a trace with confidence 0.55 → returns `state: "escalate"`
- [ ] Seed a trace with confidence 0.25 → returns `state: "block"` with non-empty `barriers`
- [ ] Unknown trace_id → returns 404

### Frontend

- [ ] `https://nyai.blackholeinfiverse.com` loads without console errors
- [ ] Network tab shows `VITE_API_URL` resolves to Render URL (not localhost)
- [ ] Submitting a legal query renders a decision panel (not a blank screen)
- [ ] Disconnecting backend → `OfflineBanner` appears within 15 seconds
- [ ] Reconnecting backend → `OfflineBanner` dismisses automatically

---

## 10. Rollback Procedure

### Frontend Rollback (Vercel)

1. Vercel → Project → Deployments
2. Find the last known-good deployment
3. Click the three-dot menu → Promote to Production
4. DNS continues pointing to Vercel — no DNS change needed

### Backend Rollback (Render)

1. Render → Service → Deploys
2. Find the last known-good deploy
3. Click Rollback
4. Render redeploys the previous Docker image / build

### Emergency: Take Backend Offline

If the backend must be taken offline immediately:

1. Render → Service → Suspend Service
2. Frontend will detect 503 → `ServiceOutage` component renders for all users
3. `useResiliency` saves all in-progress case intake to `offlineStore`
4. Data is preserved for sync when backend returns

---

## 11. Monitoring and Logs

### Render Logs

```
Render Dashboard → Service → Logs
```

Every request produces one structured JSON audit line (from `AuditLogMiddleware`):

```json
{"ts":"...","trace_id":"...","method":"POST","path":"/nyaya/query",
 "status":200,"duration_ms":312.4,"origin":"https://nyai.blackholeinfiverse.com",
 "formatted":true,"observer_triggered":true,"schema_valid":true}
```

**Alert conditions to watch for:**
- `"formatted": false` — pipeline bypass, investigate immediately
- `"observer_triggered": false` — observer pipeline not called
- `"schema_valid": false` — DecisionContract validation failed
- `"status": 500` with high frequency — agent or pipeline instability

### Vercel Analytics

Enable in Vercel → Project → Analytics for:
- Core Web Vitals (LCP, FID, CLS)
- Real User Monitoring
- Error tracking

### Health Probe

The frontend `useResiliency` hook probes `GET /health` every 15 seconds when offline. You can also set up an external uptime monitor (UptimeRobot, Better Uptime) pointing to:

```
https://nyaya-ai-0f02.onrender.com/health
```

Expected response: `{"status":"healthy","service":"nyaya-api-gateway"}`

---

## 12. Security Hardening Summary

| Measure | Implementation | File |
|---|---|---|
| CORS whitelist | `ALLOWED_ORIGINS` env var, no wildcard | `backend/main.py` |
| Content-Type enforcement | 400 on non-JSON POST | `backend/main.py` |
| Schema immutability | Pydantic `extra='forbid'` | `packages/shared/decision_contract.py` |
| Formatter gate (backend) | `validate_decision_contract()` in ResponseBuilder | `backend/response_builder.py` |
| Formatter gate (frontend) | `metadata.Formatted` check in interceptor | `src/lib/nyayaApiClient.js` |
| Audit logging | Structured JSON per request | `backend/audit_logger.py` |
| No raw tracebacks | All exceptions caught, structured error returned | `backend/router.py` |
| Enforcement fallback | `NON_ENFORCEABLE` on any fetch failure | `src/services/nyayaApi.js` |
| Error boundary | `SystemCrash` overlay on unhandled React exceptions | `src/components/ErrorBoundary.jsx` |
| TLS everywhere | Auto-provisioned on Vercel and Render | Infrastructure |
| Security headers | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` | `vercel.json` |
