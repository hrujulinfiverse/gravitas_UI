# Nyaya AI — Production Deployment Manifest
# Target: nyai.blackholeinfiverse.com

---

## 1. Architecture Overview

```
Browser (nyai.blackholeinfiverse.com)
  └─► Vercel CDN (Frontend — React/Vite)
        └─► Render (Backend — FastAPI)
              └─► Observer Pipeline (in-process)
                    └─► Formatter → DecisionContract JSON
```

---

## 2. Frontend — Vercel

**Root:** `nyaya/frontend/frontend/`

### Deploy Steps
1. Connect repo to Vercel, set **Root Directory** to `nyaya/frontend/frontend`
2. Framework: Vite | Build: `npm run build` | Output: `dist`
3. Add environment variable in Vercel dashboard:
   ```
   VITE_API_URL = https://nyaya-ai-0f02.onrender.com
   ```
4. Add custom domain `nyai.blackholeinfiverse.com` in Vercel → Domains

### DNS (at blackholeinfiverse.com registrar/DNS provider)
```
Type   Name   Value                    TTL
CNAME  nyai   cname.vercel-dns.com.    Auto
```
> If registrar requires A record at apex, use Vercel's IP: 76.76.21.21

### SSL
Vercel auto-provisions a Let's Encrypt TLS certificate for the custom domain within ~60 seconds of DNS propagation. No manual action required.

---

## 3. Backend — Render

**Service type:** Web Service  
**Root Directory:** `.` (repo root)  
**Build Command:** `pip install -r requirements.txt`  
**Start Command:** `uvicorn nyaya.backend.main:app --host 0.0.0.0 --port $PORT`

### Environment Variables (set in Render dashboard)
```
ALLOWED_ORIGINS   = https://nyai.blackholeinfiverse.com
HMAC_SECRET_KEY   = <generate: openssl rand -hex 32>
SIGNING_METHOD    = HMAC_SHA256
SIGNING_KEY_ID    = primary-key-2025
LOG_LEVEL         = info
```

### SSL
Render auto-provisions TLS for the `*.onrender.com` subdomain. No manual action required.

---

## 4. Containerization Strategy (Docker — optional VPS path)

**Dockerfile:** `Dockerfile` at repo root

```bash
# Build
docker build -t nyaya-backend:prod .

# Run
docker run -d \
  -p 8000:8000 \
  -e ALLOWED_ORIGINS=https://nyai.blackholeinfiverse.com \
  -e HMAC_SECRET_KEY=<secret> \
  --name nyaya-backend \
  nyaya-backend:prod
```

For VPS: place Nginx in front as a TLS-terminating reverse proxy:
```nginx
server {
    listen 443 ssl;
    server_name api.nyai.blackholeinfiverse.com;

    ssl_certificate     /etc/letsencrypt/live/api.nyai.blackholeinfiverse.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.nyai.blackholeinfiverse.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
Obtain cert: `certbot --nginx -d api.nyai.blackholeinfiverse.com`

---

## 5. CORS Hardening

`nyaya/backend/main.py` now reads `ALLOWED_ORIGINS` from the environment:

```python
_raw_origins = os.getenv("ALLOWED_ORIGINS", "https://nyai.blackholeinfiverse.com")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,          # strict whitelist — no wildcard
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Trace-ID",
                   "X-Pipeline-Entry", "X-No-Bypass",
                   "X-Client-Type", "X-Request-Source"],
)
```

Any request from an origin not in `ALLOWED_ORIGINS` will receive no `Access-Control-Allow-Origin` header and be blocked by the browser.

---

## 6. Environment Variable Map

| Variable | Frontend (.env.production) | Backend (.env.production) | Observer Pipeline (.env.production) |
|---|---|---|---|
| `VITE_API_URL` | `https://nyaya-ai-0f02.onrender.com` | — | — |
| `ALLOWED_ORIGINS` | — | `https://nyai.blackholeinfiverse.com` | `https://nyai.blackholeinfiverse.com` |
| `HMAC_SECRET_KEY` | — | `<secret>` | `<secret>` |
| `HOST` | — | `0.0.0.0` | — |
| `PORT` | — | `8000` | — |
| `LOG_LEVEL` | — | `info` | `info` |

---

## 7. End-to-End Execution Path

```
1. User opens https://nyai.blackholeinfiverse.com
2. React UI loads from Vercel CDN (HTTPS/TLS via Let's Encrypt)
3. User submits legal query → POST https://nyaya-ai-0f02.onrender.com/nyaya/query
4. Browser sends CORS preflight (OPTIONS) → backend checks origin against ALLOWED_ORIGINS
5. FastAPI router → LegalAgent (Decision Engine)
6. LegalAgent result → ObserverPipeline.process_result()
7. ObserverPipeline → Formatter → DecisionContract JSON
8. Response includes metadata.Formatted = true (validated by nyayaApiClient interceptor)
9. Frontend renders GravitasDecisionPanel with validated contract
```

---

## 8. Connectivity Checklist

- [ ] DNS: `nyai.blackholeinfiverse.com` CNAME → `cname.vercel-dns.com` resolves
- [ ] TLS: `https://nyai.blackholeinfiverse.com` returns valid cert (no browser warning)
- [ ] Backend health: `GET https://nyaya-ai-0f02.onrender.com/health` → `{"status":"healthy"}`
- [ ] CORS preflight: `OPTIONS /nyaya/query` from `nyai.blackholeinfiverse.com` → `200` with correct `Access-Control-Allow-Origin`
- [ ] Query flow: `POST /nyaya/query` returns `metadata.Formatted = true` in response body
- [ ] Observer pipeline: response includes `observation.pipeline_stage = "observer_pipeline"`
- [ ] DecisionContract: `nyayaApiClient` interceptor logs `✅ DecisionContract: Schema validation passed`
- [ ] Wildcard CORS blocked: request from `https://evil.example.com` receives no ACAO header
- [ ] Vercel env var `VITE_API_URL` resolves to Render URL in production build (check Network tab)
- [ ] No `allow_origins=["*"]` present anywhere in deployed backend (grep confirmed)
