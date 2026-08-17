# Rate limiting, bans and CGNAT — aligning the layers

**Why this exists:** four independent systems currently limit traffic, all keyed on IP, none aware
of the others, and one of them **turns another one's output into a ban**. The visible symptom is
users on mobile networks getting "network error" — see §1.

**Cloudflare IP ranges verified current 2026-08-17** (15 v4 + 7 v6, exact match with
`cloudflare.com/ips-v4` and `-v6`). `real_ip` needs no change.

---

## 1. The bug: fail2ban bans users for hitting our own rate limit

`/etc/fail2ban/filter.d/nginx-4xx-5xx.conf`:

```
failregex = ^<HOST> - - .*"[^"]*" (4\d\d|5\d\d) \d+ "[^"]*"
```

`4\d\d` matches **429** — the status nginx returns when *our own* `limit_req` throttles someone.
With `maxretry = 40`, `findtime = 2m`, `bantime = 2h`:

```
nginx limits at 3 r/s        →  429
fail2ban counts 429 as an attack
40 of them in 2 minutes      →  IP banned at the firewall for 2 hours
[recidive]: 5 bans in a day  →  banned for 7 days
```

A banned IP gets its packets dropped, so the browser sees a connection failure — axios reports
`ERR_NETWORK`, which the UI shows as "network error".

> ### CHECKED 2026-08-17 — this is NOT what is breaking mobile users
>
> The hypothesis above was plausible and wrong. The ban log shows only **five** nginx-jail bans,
> every one of them an automated scanner:
>
> ```
> [nginx-404] / [nginx-4xx-5xx]  74.248.130.103, 20.79.222.117,
>                                20.163.43.14, 20.118.172.148, 20.228.229.148
> ```
>
> The `20.x` addresses are Microsoft Azure ranges; these are bots hitting 404 storms. **Currently
> banned: 0.** Everything else in the log is `[sshd]` catching real SSH brute-force, which is
> working correctly and should be left alone.
>
> The filter is still wrong and worth fixing (see Step 1) — the log even shows the
> double-counting, with each `nginx-404` ban followed three seconds later by an
> `nginx-4xx-5xx` ban of the same IP — but it is **defence in depth, not the mobile bug**.
>
> **The surviving explanation is §6: an unreadable 429.** nginx rate-limits at 3 r/s per IP;
> on CGNAT that is shared by a whole carrier segment. The 429 (or a 503 from `limit_conn`)
> carries **no CORS headers**, so the browser cannot read it and axios reports `ERR_NETWORK` —
> which the UI renders as "network error". No ban is required to produce the symptom; the
> throttle alone does it. **This makes Step 6 the first thing to do, not the last:** it is
> simultaneously the fix and the instrument that confirms the cause.

It is much worse on mobile because carriers use **CGNAT**: thousands of subscribers share one
public IPv4. Banning it bans all of them. Corporate, university and public-wifi NAT behave the
same way.

The same regex also counts:

* **401** — produced by normal token-refresh churn on every expired session.
* **403** — produced by entitlement gates telling a guest to log in.
* **404** — already covered by its own jail, so it is double-counted.

**None of those are attack evidence.** They are the application working correctly.

### Second problem: behind Cloudflare, the ban may not even do anything

fail2ban extracts `<HOST>` from the nginx access log. `real_ip` has rewritten that to the true
client IP, so fail2ban bans **the client's real address in iptables** — but every packet actually
arrives from a **Cloudflare edge**. iptables never sees the client address, so the ban is inert.

Which means the current setup is likely in one of two states, and you must determine which:

| If banned entries are… | Meaning |
|---|---|
| real client IPs | bans do nothing; fail2ban is decorative — but the counters still consume CPU and the *appearance* of protection is misleading |
| Cloudflare IPs | catastrophic — one ban blocks a whole edge and a large share of ALL traffic |

Check before changing anything:

```bash
sudo fail2ban-client status nginx-4xx-5xx
sudo grep ' Ban ' /var/log/fail2ban.log | tail -50
sudo iptables -S | grep f2b | head -20
```

If any banned address falls inside a Cloudflare range (§ the `set_real_ip_from` list), stop and
unban immediately.

---

## 2. Give each layer one job

The layers overlap today because they all do the same thing — count requests per IP. The
industry-standard split assigns each a distinct role, keyed on the most specific identity it can
see.

| Layer | Job | Key | Tightness |
|---|---|---|---|
| **Cloudflare** | bots, ASN/country, gross volumetric abuse, blocking | IP / ASN / JA4 / bot score | edge policy |
| **nginx** | connection-level abuse net | real IP | **very loose** — no real user should ever meet it |
| **Application** | fairness and quotas | **user id / visitor id** | tight, meaningful |
| **fail2ban** | repeat offenders → push blocks to Cloudflare | real IP | only on genuine attack signals |

The principle: **IP is the wrong key for fairness.** It is shared by strangers and rotated by
ISPs. Use it only to stop abuse that is itself IP-shaped (scanning, floods). Fairness belongs on
identity — and we already have it: `X-Device-Hash` derives a server-side `visitor_id`, and
logged-in users have an account id.

---

## 3. Current settings, and what is wrong with each

| Layer | Setting | Value | Problem |
|---|---|---|---|
| nginx | `api_rl` | 3 r/s, burst 10, **nodelay** | ~1.5 real calls/s once preflights are counted; rejects instantly instead of delaying |
| nginx | `global_rl` | 5 r/s, burst 10 | same class |
| nginx | `admin_rl` | 10 r/**min** | an admin page load makes more calls than this |
| nginx | `perip_conn` | 20 (api) / 30 (server) | a browser opens ~6 per host; on CGNAT this is a handful of users |
| app | login | 5/min **per IP** | one office or carrier NAT locks everyone out; stress setup had to sleep 60s for this |
| app | `frontend_similarity_burst_per_min` | 30/min **per IP**, shared by search+upload | should be per visitor/user |
| fail2ban | `nginx-4xx-5xx` | 40 in 2m → 2h | **counts our own 429s, plus 401/403/404** |
| fail2ban | `recidive` | 5 bans/day → 7d | amplifies the above to a week |

### Correction: admin was never unprotected

An earlier draft said admin had no nginx rate limit. That was wrong. `admin_auth_router` is mounted
with `V1_PREFIX = "/api/v1"` and carries `prefix="/admin/auth"`, so the live path is
**`/api/v1/admin/auth/login`** — which matches `location ~ ^/(api|search|upload|v1|v2)/` and has
always been governed by `api_rl`.

What is true is narrower: **the `admin_rl` zone is defined and never referenced by any `limit_req`**
— dead config, not a gap. Admin's real protection is `api_rl` plus the app-level
`@limiter.limit(auth_rate_limit("login"))` = **5/minute per IP** on `/admin/auth/login`.

Consequence worth noting: admin was therefore on the **3 r/s** budget until 2026-08-17, and an
admin dashboard makes many calls per page load. That is a plausible contributor to admin feeling
unreliable on shared/mobile connections, separate from the 520 outage.

Additional multiplier: **every API call is preflighted**, because `X-Device-Hash` makes requests
non-simple. So each logical call costs two requests against every IP-keyed limit, and the
preflight cache is keyed per full URL — search-as-you-type issues a fresh preflight per keystroke.

---

## 4. The plan, in order

Each step is independently safe and independently useful. Do them in this order; the first is the
one that stops users being banned.

### Step 1 — stop banning people for our own 429s (do first)

Narrow the filter to genuine attack signals. 429 is our limiter working; 401/403 are the app
working.

```bash
sudo tee /etc/fail2ban/filter.d/nginx-4xx-5xx.conf >/dev/null <<'EOF'
[Definition]
# Deliberately EXCLUDES 429 (our own rate limiter — banning for it double-punishes a user
# who is already being throttled, and on CGNAT bans an entire carrier), and 401/403
# (normal auth churn and entitlement gates). 404 has its own jail.
failregex = ^<HOST> - - .*"[^"]*" (400|405|408|411|413|414|431|5\d\d) \d+ "[^"]*"
ignoreregex =
EOF
sudo fail2ban-client -t && sudo systemctl restart fail2ban
```

Then clear anyone currently serving a sentence:

```bash
sudo fail2ban-client unban --all
```

### Step 2 — make bans effective, or remove them

Decide based on the §1 check.

* **Origin is locked to Cloudflare** (ufw allows only CF ranges): iptables bans of client IPs are
  inert. Either push bans to Cloudflare with fail2ban's built-in `cloudflare` action (needs an API
  token), or disable the nginx jails and do blocking at the edge, where it actually applies.
* **Origin is directly reachable**: that is a bigger problem than rate limiting — it means
  Cloudflare's WAF, bot rules and DDoS protection can all be bypassed by hitting the IP. Lock it
  down first.

Keep `[recidive]` only once bans are effective; otherwise it just multiplies an inert counter.

### Step 3 — retune nginx to be an abuse net, not a traffic shaper

```nginx
limit_req_zone  $binary_remote_addr zone=api_rl:10m    rate=25r/s;
limit_req_zone  $binary_remote_addr zone=global_rl:10m rate=30r/s;
limit_req_zone  $binary_remote_addr zone=admin_rl:2m   rate=120r/m;
limit_conn_zone $binary_remote_addr zone=perip_conn:10m;
```

and in the API location:

```nginx
limit_req  zone=api_rl burst=50 delay=25;
limit_conn perip_conn 100;
```

Two deliberate changes beyond the numbers:

* **`delay=` instead of `nodelay`.** `nodelay` serves the burst instantly then rejects the next
  request outright. `delay=25` serves 25 immediately, *queues and slows* the next 25, and rejects
  only beyond that. A bursty SPA rides through; a flood still gets throttled. This alone absorbs
  search-as-you-type.
* **Higher `limit_conn`.** Browsers open ~6 connections per host, so 20 is roughly three
  simultaneous users behind one NAT.

**Changing a zone `rate` is reloadable; changing a zone KEY is not** — a key change needs
`systemctl restart nginx`, or the reload fails with
`[emerg] limit_req "api_rl" uses the … key while previously it used …` while nginx keeps serving
the old config.

### Step 4 — do not count work we did not do

Preflights consume budget while doing nothing. Exempt `OPTIONS` from the API limiter, e.g.:

```nginx
map $request_method $limit_this {
    OPTIONS "";              # empty key -> not accounted
    default $binary_remote_addr;
}
```

(Use it as the zone key. Same "empty key is not counted" mechanism the phase-4 exemption relied
on — the mechanism was fine; putting `$binary_remote_addr` into a *response header* was not.)

### Step 5 — move application limits off IP and onto identity

> **Verified 2026-08-17: the industry-standard control is ALREADY implemented.**
>
> ```python
> # Account Lockout (brute-force protection, per-account, complements the IP rate limiter)
> login_max_failed_attempts: int = 10
> login_lockout_minutes:     int = 15
> ```
>
> `_register_login_failure` keys on **`user_id`**, increments only on a **wrong password**, and is
> enforced in both `auth_service.py` and `admin_auth_controller.py`. That is exactly what OWASP
> prescribes: per-account, failure-counted, time-boxed.
>
> **Therefore the per-IP `5/minute` login cap is the redundant layer, not the primary one**, and
> loosening it does not weaken security. It is also weak against the real threat: credential
> stuffing arrives from botnets — thousands of IPs trying a few accounts each — so a per-IP cap
> never fires, while reliably locking out an office or a carrier NAT. Raise it to ~60/min as a
> "single host hammering" net and leave the account lockout untouched. The next standard step
> after that is a challenge/CAPTCHA on repeated failure, **not** a tighter IP cap.

* **Login:** keep a per-**account** limit (that is what stops credential stuffing on one account)
  and raise the per-IP limit to something a shared NAT survives. 5/min per IP is why the stress
  setup had to sleep 60 seconds between logins.
* **`frontend_similarity_burst_per_min`:** re-key to `visitor_id` / user id instead of IP. Ten
  people in one office currently share one budget of 30.
* Note this value is **not registered in `config.py`'s env-mapping table**, so it cannot be
  changed from `.env` — it needs a code edit plus a restart.

### Step 6 — make 429 readable (also fixes a whole class of mystery)

Nothing above helps if the client cannot tell a 429 from a 502. nginx-generated responses
currently carry **no CORS headers** (`$cors_allow_origin` is defined in
`conf.d/ratelimits_realip.conf` and never used), so every one of them reaches the browser as a
phantom "CORS error" — see `docs/CORS_OUTAGE_AUG2026.md` §5.

Add, using the map that already exists:

```nginx
add_header 'Access-Control-Allow-Origin'      $cors_allow_origin always;
add_header 'Access-Control-Allow-Credentials' 'true'             always;
add_header 'Vary'                             'Origin'           always;
add_header 'Retry-After'                      '5'                always;
```

* `always` is mandatory, or it is skipped on exactly the 4xx/5xx that matter.
* **nginx `add_header` appends**, so never let it fire on a successful proxied response that
  already carries FastAPI's header — the browser rejects two values.
* `add_header` in a `location` **replaces** everything inherited from `server`, so any location
  that adds one must repeat the security headers.

A client that can read a 429 backs off. A client that sees a network error retries blindly and
makes it worse.

### Step 7 — reduce the request count

> **Correction 2026-08-17: search-as-you-type is ALREADY debounced** and this was recommended in
> error. `apps/webapp/src/hooks/useWorkspaceSearch.ts:127` waits 500 ms after the last keystroke
> and cancels the pending timer on each change. Correct implementation, sensible delay, nothing
> to do.

What remains:

* Collapse the bootstrap calls (auth refresh, entitlements, telemetry, …) into fewer.
* The `X-Device-Hash` header makes every request non-simple, so each logical call costs **two**
  HTTP requests. Moving the guest device signal to a cookie would halve API request volume
  outright — the largest remaining multiplier, now that debouncing is ruled out.

### Step 8 — later: IP policy at the edge

Cloudflare Rate Limiting can key on ASN, JA4 fingerprint, bot score and country — so "generous
for known mobile carrier ASNs, strict for datacenter ranges" becomes expressible, which it is not
in nginx. Cloudflare also handles **IPv6 correctly by /64**: a phone rotates addresses within its
/64 via privacy extensions, so a /128 key gives one device unlimited budget while a /64 key gives
one subscriber one bucket. nginx cannot truncate natively.

---

## 5. Verification

After each step:

```bash
sudo fail2ban-client status                     # jails and current bans
sudo grep ' Ban ' /var/log/fail2ban.log | tail  # who is being banned, and for what
sudo awk '$9==429' /var/log/nginx/access.log | wc -l
```

Healthy looks like: **zero bans of ordinary users**, 429s rare and confined to genuine floods,
and any 429 that does occur arriving in the browser as a readable 429 rather than a network or
CORS error.

---

## 5a. Status — applied 2026-08-17

| Step | State |
|---|---|
| 1 — fail2ban filter excludes 429/401/403/404 | **done** (defence in depth; it was never the mobile cause — see §1) |
| 2 — make bans effective, or remove | **open** — decide whether the origin is CF-locked; iptables bans of client IPs are inert behind Cloudflare |
| 3 — nginx retune | **done** — `api_rl` 3→25 r/s, `global_rl` 5→30 r/s, `admin_rl` 10r/m→120r/m, `limit_conn` 20/30→100, `nodelay`→`delay=` |
| 4 — exempt OPTIONS | **done** — `map $request_method $rl_ip` |
| 5 — app limits onto identity | **open** — login 5/min and the 30/min similarity brake are still per IP |
| 6 — CORS on nginx errors | **done** — conditional on `$upstream_http_access_control_allow_origin` |
| 7 — reduce request count | **open** — debounce search-as-you-type; collapse bootstrap calls |
| 8 — IP policy at the edge | **open** |

Verified after applying: a successful response carries **exactly one**
`Access-Control-Allow-Origin` (the duplication failure mode would have broken every request), and
preflights return 200.

---

## 5b. Security posture — what we have vs. what the standard asks for

Assessed 2026-08-17, after the day's changes.

### In place and correct

| Control | Status |
|---|---|
| Cloudflare in front (WAF, DDoS, TLS) | yes |
| Real client IP restored, CF ranges current | yes — verified 22/22 |
| Per-IP request + connection limits, sanely tuned | yes — 25 r/s with `delay=`, conn 100 |
| Preflights excluded from limits | yes |
| Errors readable cross-origin | yes |
| Security headers: XCTO, XFO, Referrer-Policy, HSTS | yes — restored when the stress headers were removed |
| **Per-account login lockout** (10 failures / 15 min) | yes — the control that actually stops brute force |
| fail2ban on **SSH** | yes — catching real brute force daily |
| RBAC, JWT, admin auth isolated from the main site | yes |
| Antivirus scan on every upload | yes |
| Per-user quotas and entitlements | yes |

### Gaps, ranked by impact

1. **Origin reachable on the public IP.** On 2026-08-17 the decommissioned sandbox answered `200`
   on `http://<origin-ip>:8004`, bypassing Cloudflare and nginx entirely, and had done so since
   May. **Verify port 8001 is not similarly exposed.** If the origin is directly reachable, every
   control above is optional from an attacker's point of view. Standard fix: `ufw` allow 80/443
   **only from Cloudflare's ranges**, or Cloudflare Tunnel, plus Authenticated Origin Pulls.
   *This is the highest-value security item outstanding.*
2. **No Content-Security-Policy** (and no `Permissions-Policy`). The other OWASP headers are set;
   CSP is the significant absent one for a browser app.
3. **Login rate limit still per IP** (§Step 5) — a reliability problem, not a security one, now
   that the per-account lockout is confirmed.
4. **fail2ban's nginx jails are inert behind Cloudflare** — iptables cannot see client addresses.
   Either use fail2ban's `cloudflare` action or accept them as decorative. (SSH jail is unaffected
   and valuable.)
5. **The client does not honour `Retry-After`.** nginx now sends it; the frontend should back off
   exponentially rather than retry blindly.
6. **`/health` returns 403 to UptimeRobot** — carried from the phase-4 backlog §6. Uptime
   monitoring has been failing continuously on both media and Alwyzon, so an outage like the
   2026-08-17 one is discovered by a human rather than a monitor.
7. **Alwyzon still runs one uvicorn process** on 6 cores. Any synchronous call stalls every
   request on the box — the cause of the 2026-08-14 latency collapse, and the reason the next one
   will be equally expensive.
8. **No alerting on 429 / 5xx rate.** Both are now measurable; nothing watches them.

---

## 6. TODO carried from the CORS outage

* `map $http_origin $cors_allow_origin` does not match the app's allow-list: nginx has
  `stack.resomix.com` and `landing.resomix.com`; the app allows `www.resomix.com`,
  `embed.resomix.com` and `api-docs.resomix.com`, none of which are in the map. Inert while the
  map is unused — becomes real the moment Step 6 lands.
* Refresh the Cloudflare `set_real_ip_from` ranges periodically. Verified current 2026-08-17. If
  Cloudflare adds a range and we do not, clients arriving through it lose real-IP restoration and
  silently share one bucket.
* **`admin_rl` zone is dead config** — defined, never referenced. Either wire it to the
  `/api/v1/admin/` paths with a dedicated `location`, or delete it. Leaving it invites the same
  mistake I made: reading the zone and assuming it is in force.
* **`sandbox` vhost points at a decommissioned service** (`sandbox.resomix.com` →
  `127.0.0.1:8004`). Decision 2026-08-17: **stop the service, keep the vhost** — the sandbox may
  be revived, and keeping the vhost preserves its TLS certificate and Certbot renewal. Until then
  the host returns 502 to anyone who visits, which is acceptable because nobody should be.
  Re-check with `sudo ss -ltnp | grep 8004`.
* **Move the login limit off IP.** `@limiter.limit(auth_rate_limit("login"))` is `5/minute` **per
  IP** and applies to both the webapp and admin login. One office, one carrier NAT, or one
  developer retrying locks out everyone behind that address — it is also why the stress suite has
  to sleep 60 seconds between account logins. Should be per-account, with a much looser per-IP
  net behind it.
