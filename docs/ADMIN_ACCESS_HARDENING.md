# Admin access hardening — Cloudflare Access + origin lockdown

**Status:** Backend code landed (Cloudflare Access dependency, **disabled by default**). Origin
lockdown (ufw) + enabling steps are operator actions. 2FA-on-admin is a follow-up.
**Date:** 2026-07-27
**Owner context:** admin surface is `r-admin.resomix.com`; origin is `193.219.97.122` (Alwyzon).

---

## 1. The finding (verified by direct-origin probing)

Cloudflare Zero Trust **Access** was configured on `r-admin.resomix.com` (4 allowed emails, email
OTP + Google). But a direct hit on the origin IP bypassed it completely:

```
curl -k -i --resolve r-admin.resomix.com:443:193.219.97.122 https://r-admin.resomix.com/
→ HTTP/1.1 200 OK   {"name":"Resomix API", ...}
```

- The DNS record is proxied (orange cloud) ✅ — but the **origin itself accepts direct connections
  from any IP**, so Access (and the Cloudflare WAF / rate-limiting) can be skipped entirely.
- `193.219.97.122` is **not** a Cloudflare IP, and a TLS handshake from a laptop completed — proof
  the origin is not restricted to Cloudflare and is not using Authenticated Origin Pulls.
- `/docs` → 404 (Swagger not exposed ✅). `/admin/auth/refresh` → 405 `allow: POST` (admin routes
  **are** served directly from the origin, guarded only by the app's admin JWT).

**Severity:** not a data leak (protected routes still require the admin JWT), but the entire Access
perimeter is inert until the origin only accepts Cloudflare.

## 2. Architecture that shapes the fix

- `r-admin.resomix.com` → serves the **admin SPA** (static), behind Cloudflare Access.
- The admin SPA's **API calls go to `bserver.resomix.com`** (`apps/admin/.env` →
  `VITE_SERVER_BACKEND`, default `https://bserver.resomix.com`) — a **different hostname with NO
  Access application**. Same physical origin, different host.

Consequence: Cloudflare only injects the `Cf-Access-Jwt-Assertion` header on `r-admin`, **not** on
the API host. So a CF-Access check on the admin API **cannot be switched on as-is** — it would 403
every admin call. Two ways to make the API Access-covered (pick one before enabling — §5):

- **(A, recommended)** Serve the admin API **same-origin** under `r-admin.resomix.com/api/...`
  (admin app `VITE_SERVER_BACKEND=https://r-admin.resomix.com`, nginx proxies `/api` → FastAPI).
  Then the Access cookie/JWT is naturally present and same-site.
- **(B)** A path-scoped Access app on `bserver/api/v1/admin/*`. Fragile with a cross-origin SPA
  (the `CF_Authorization` cookie won't ride cross-site fetches) — not recommended.

## 3. Defence-in-depth model (target)

| Layer | Mechanism | Status |
| --- | --- | --- |
| Network perimeter | **Origin only accepts Cloudflare** (ufw) | ⬜ operator action (§4) |
| Edge identity | **Cloudflare Access** JWT on admin routes | 🔶 code ready, disabled (§5) |
| App identity | Admin JWT (`require_admin`, role in DB) | ✅ existing |
| App second factor | **TOTP 2FA on admin login** | ⬜ follow-up (§6) |

Each layer must be able to stand alone — if one control is misconfigured, the next still holds.

---

## 4. Origin lockdown — ufw (the critical fix)

Restrict the origin to Cloudflare so ALL traffic (r-admin, bserver, everything) must pass through
Cloudflare. This closes the bypass for the whole box in one move.

**Pre-flight — check state (must be `active`):**
```bash
sudo ufw status verbose
```
If `Status: inactive`, STOP — enabling ufw sets default-deny for *every* port and can cut other
services. Inventory inbound needs first.

### 4a. What actually reaches this origin — impact analysis (verified in code)

- **Webapp / consumer / admin-UI traffic is NOT affected.** The frontend calls only
  `bserver.resomix.com` (API), `media.resomix.com` (HLS/previews/similarity) and
  `analysis.resomix.com` — all Cloudflare-proxied. Locking the origin to Cloudflare only blocks
  traffic that *skips* Cloudflare, so everything already going through Cloudflare keeps working.
- **Inter-server:** the primary direction is **Alwyzon → Hetzner** (media/analysis boxes are
  receivers of Alwyzon's `X-Internal-Key` calls) — outbound from Alwyzon, unaffected by its inbound
  firewall. But Alwyzon **also exposes inbound internal endpoints** for the Hetzner side:
  `/internal/notify/*` (media → Alwyzon notifications) and `/internal/sftp/*` (SFTPGo auth hook).
  No live caller for these was found in the current media/analysis code — the caller URL is
  env-configured — so **verify empirically, then allowlist the caller's IP** rather than assume.

**Verify who currently hits the origin from non-Cloudflare IPs (run a few times):**
```bash
sudo ss -tnH '( sport = :443 or sport = :80 )' | awk '{print $5}' | sed 's/:[0-9]*$//' | sort | uniq -c | sort -rn | head -30
```
```bash
sudo grep -hE "/internal/(notify|sftp)" /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head
```
Known trusted internal IPs to allowlist: media/analysis `135.181.218.143`, GPU `46.4.100.18`
(possibly `95.216.116.115`). Because §4 allowlists these boxes **and** Cloudflare, no legitimate
call breaks whether it uses Cloudflare or a direct IP.

**Keep SSH open (idempotent, critical — never lock yourself out):**
```bash
sudo ufw allow OpenSSH
```

**Allow Cloudflare (IPv4 + IPv6) to 80/443:**
```bash
for ip in $(curl -fsSL https://www.cloudflare.com/ips-v4) $(curl -fsSL https://www.cloudflare.com/ips-v6); do sudo ufw allow proto tcp from "$ip" to any port 80,443 comment 'Cloudflare edge'; done
```

**Allow our own trusted boxes (so internal calls never break — see §4a):**
```bash
for ip in 135.181.218.143 46.4.100.18; do sudo ufw allow proto tcp from "$ip" to any port 80,443 comment 'Hetzner internal'; done
```
(Add any other internal IP the §4a check reveals, e.g. `95.216.116.115`, the same way.)

**Block everyone else from 80/443 (added after the allows, so Cloudflare/internal still get through):**
```bash
sudo ufw deny proto tcp to any port 80,443 comment 'block non-Cloudflare web'
```

**Remove any pre-existing "open to the world" web rules (harmless if absent):**
```bash
sudo ufw delete allow 'Nginx Full'; sudo ufw delete allow 'Nginx HTTP'; sudo ufw delete allow 'Nginx HTTPS'; sudo ufw delete allow 80/tcp; sudo ufw delete allow 443/tcp; sudo ufw delete allow 80; sudo ufw delete allow 443
```

**Apply + verify:**
```bash
sudo ufw reload && sudo ufw status verbose
```

**Prove the bypass is closed (from your laptop — expect a timeout/refusal now):**
```bash
curl -k -i --max-time 8 --resolve r-admin.resomix.com:443:193.219.97.122 https://r-admin.resomix.com/ ; echo "exit=$?"
```
Then confirm the site still works normally in a browser (that path goes through Cloudflare).

**Rollback if anything breaks:**
```bash
sudo ufw delete deny proto tcp to any port 80,443
```

### Caveats — check before running
- **Internal callers.** If any OTHER server (media/similarity, or the internal
  `sftp`/`notify` webhook routes) calls THIS box **directly by public IP/hostname** rather than
  through Cloudflare, those calls will now be blocked. Add each source:
  ```bash
  sudo ufw allow proto tcp from <OTHER_SERVER_IP> to any port 443 comment 'internal svc'
  ```
  (Stripe webhooks arrive via Cloudflare → already covered.)
- **Port 80 / TLS renewal.** If the origin renews certs via certbot HTTP-01 (port-80 challenge from
  the internet), locking 80 breaks renewal. With Cloudflare Origin CA certs or DNS-01 you're fine.
  If unsure, lock 443 only first (drop `80,` → `443`).
- **Stronger follow-up:** add **Authenticated Origin Pulls** (mTLS) so the origin requires
  Cloudflare's client cert — removes reliance on the shared CF IP ranges.

---

## 5. Cloudflare Access on admin routes (backend — landed, disabled)

Code is in place and verified; it is a **no-op until `CF_ACCESS_ENABLED=true`**.

**Files**
- `app/utils/cf_access.py` — JWKS fetch (cached 15 min, refresh on unknown `kid`) + `verify_access_jwt()`
  (RS256, checks `aud`, `iss`, expiry). Mirrors the jose-based `app/utils/edge_auth.py`.
- `app/api/dependencies/cf_access.py` — `require_cf_access` dependency: no-op when disabled; else
  requires a valid `Cf-Access-Jwt-Assertion` (header, or `CF_Authorization` cookie fallback) → 403.
- `app/api/routers/__init__.py` — exports `admin_routers` (identity list).
- `app/main.py` — attaches `require_cf_access` to every admin router in **both** the `/api/v1` and
  legacy-root registrations (verified: 110/110 admin routes covered incl. `/admin/auth/login`; 0
  non-admin routes touched).
- `app/core/config.py` + `.env.example` — `CF_ACCESS_ENABLED`, `CF_ACCESS_TEAM_DOMAIN`,
  `CF_ACCESS_AUD`.

**Known values**
- Team domain: `veggera.cloudflareaccess.com`  → JWKS `https://veggera.cloudflareaccess.com/cdn-cgi/access/certs`
- AUD tag: `19e9a92db48f3ed1866a053f7f6058c98517ae23b760a6d7cc3de0c9ea3f7080`

**⚠️ Do NOT set `CF_ACCESS_ENABLED=true` until the admin API is Access-covered (§2, option A).**
Enabling it while the admin app still calls `bserver` (no Access app) will 403 the whole panel.

**Enable sequence (after option A routing is in place):**
1. Point the admin app at the Access-protected origin: `apps/admin/.env`
   `VITE_SERVER_BACKEND=https://r-admin.resomix.com`; rebuild/redeploy the admin app.
2. nginx: make `r-admin` proxy `/api/...` (and `/admin/...`) to the FastAPI origin.
3. Backend `.env`: `CF_ACCESS_ENABLED=true`, `CF_ACCESS_TEAM_DOMAIN=veggera.cloudflareaccess.com`,
   `CF_ACCESS_AUD=<tag above>`; restart.
4. Verify: admin panel works through Cloudflare; a direct-origin admin call (no Access JWT) → 403.

---

## 6. Admin login 2FA (follow-up)

Add TOTP to the admin login as the app-layer second factor (matters most if the origin is ever
directly reachable again). The main site already has a full TOTP flow (`pyotp`, `otp_secret` on
`users`, `/auth/verify-2fa`) — **reuse it** for the admin login (`admin_auth_controller`) rather
than building new. Keep the admin session short.

---

## 7. Recommended order

1. **ufw origin lockdown (§4)** — the actual vulnerability; protects the whole box. Do first.
2. **TOTP 2FA on admin (§6)** — strong app-layer factor; independent of the network fix.
3. **Access on the admin API (§2 option A + §5)** — full edge coverage of the API; larger change
   (frontend base URL + nginx), do when there's time to test.
4. Authenticated Origin Pulls; short Access session; admin login rate-limit; admin audit logging.
