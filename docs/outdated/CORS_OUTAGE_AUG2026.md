# The "CORS error on everything" outage — 2026-08-17

**Symptom:** every API call from `https://beta.resomix.com` failed in the browser with
"No 'Access-Control-Allow-Origin' header is present". Login, search and admin were all dead. Yet
the server logged `OPTIONS … 200 OK` for the very requests the browser said had failed.

**Root cause:** a leftover phase-4 debug line put **raw binary bytes into an HTTP response
header**, producing a malformed response that Cloudflare rejected with 520. It was never a CORS
problem and never a rate-limit problem.

**Fix:** delete two `add_header` lines. **Time to resolve once identified:** one `reload`.

---

## 1. What actually happened

`/etc/nginx/sites-enabled/bserver`, inside `location ~ ^/(api|search|upload|v1|v2)/`:

```nginx
access_log /var/log/nginx/stressdbg.log stressdbg;
add_header X-Stress-Exempt $stress_exempt always;
add_header X-Stress-Key "[$rl_key]" always;      # <-- this one
```

`$rl_key` comes from the phase-4 exemption pair at http level:

```nginx
geo $stress_exempt { … }                  # 1 for the two load-generator IPs, else 0
map $stress_exempt $rl_key {
    0 $binary_remote_addr;                # NOT exempt  -> raw binary
    1 "";                                 # exempt      -> empty
}
```

`$binary_remote_addr` is **binary** — 4 bytes for IPv4, 16 for IPv6. For `119.73.19.106` that is
`0x77 0x49 0x13 0x6A`, and `0x13` is a control character. nginx wrote those bytes verbatim into a
response header on every `/api/` response. Control characters are not legal in header values, so
Cloudflare treated the origin response as invalid and returned **520**. Cloudflare's 520 page
carries no CORS headers, so the browser reported the only thing it could see: a missing
`Access-Control-Allow-Origin`.

### Why the server looked perfectly healthy

The corruption happened **after** the app answered. uvicorn returned a correct `200` with correct
CORS headers; nginx then appended the malformed header; Cloudflare rejected the result. Reading
the application log could never have found this — the app was innocent and said so.

### Why it started with no deploy

The last backend commit predated the outage by two days. What changed was the developer's **IP**.

While the laptop was one of the exempt IPs, `$rl_key` was `""` and the header read
`X-Stress-Key: []` — valid and harmless. The ISP reassigned the address to `119.73.19.106`, which
is not in the `geo` list, so `$rl_key` became `$binary_remote_addr` and every `/api/` response
became malformed from that moment.

The exemption was not a safety net that failed. It was **masking a broken debug line** the whole
time, and only the two exempt IPs were ever getting a valid response from that location block.

---

## 2. Diagnosis trail (and one wrong turn worth recording)

| Step | Evidence | Conclusion |
|---|---|---|
| Browser | "No 'Access-Control-Allow-Origin' header" | not necessarily CORS — any header-less error looks like this |
| App startup | `CORS origins: … https://beta.resomix.com …` | origin allow-list correct |
| App code | `cors_allow_headers` includes `X-Device-Hash`, methods and `max_age` fine | FastAPI CORS config correct |
| Starlette behaviour | rejected origin returns **400** `"Disallowed CORS origin"`, not 200 | a `200` preflight means the app **allowed** it and set the header |
| App log | `OPTIONS … 200 OK` for the failing requests | the app answered correctly; corruption is downstream |
| **curl** | **`520` six times** | **Cloudflare rejecting the origin response — not 429, not the app** |
| nginx config | `add_header X-Stress-Key "[$rl_key]"` with `$rl_key = $binary_remote_addr` | root cause |

**The wrong turn:** an initial hypothesis blamed `limit_req` (3 r/s) returning header-less 429s.
It was plausible — nginx error pages genuinely carry no CORS headers here — but the curl result
killed it: 520, not 429, and every request reached uvicorn. **The single most useful command in
this whole investigation was `curl -D-` against the public URL**, because it was the only thing
that showed the real status code. The browser hides it behind the CORS message, and the app log
never sees it.

---

## 3. The fix that restored service

```bash
sudo sed -i '/add_header X-Stress-Exempt/d; /add_header X-Stress-Key/d; /stressdbg/d' \
  /etc/nginx/sites-enabled/bserver && sudo nginx -t && sudo systemctl reload nginx
```

Verified — six `200`s where there had been six `520`s:

```bash
for i in 1 2 3 4 5 6; do
  curl -sS -o /dev/null -w "%{http_code} " -X OPTIONS \
    "https://bserver.resomix.com/api/v1/search_tracks/?query=aa$i&mode=auto" \
    -H 'Origin: https://beta.resomix.com' \
    -H 'Access-Control-Request-Method: GET' \
    -H 'Access-Control-Request-Headers: x-device-hash'
done; echo
```

`reload` is sufficient here: only `add_header` / `access_log` lines were removed, no zone **key**
changed.

### A side effect that had been live the whole time

`add_header` in a `location` block **replaces every inherited `add_header` from `server`**. Those
two stress headers were therefore suppressing `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy` and **HSTS** on every `/api/` response for the duration of phase 4. Removing
them restored all four.

---

## 4. Remaining cleanup — the rest of the phase-4 scaffolding

Still present at http level (`sudo grep -rn 'geo \$stress_exempt' /etc/nginx/` to locate the file):

```nginx
geo $stress_exempt { … }
map $stress_exempt $rl_key { … }
limit_req_zone  $rl_key            zone=api_rl:10m     rate=3r/s;
limit_req_zone  $rl_key            zone=global_rl:10m  rate=5r/s;
limit_req_zone  $binary_remote_addr zone=admin_rl:2m   rate=10r/m;
limit_conn_zone $rl_key            zone=perip_conn:10m;
log_format stressdbg '$remote_addr exempt=$stress_exempt key=[$rl_key] …';
```

**Order matters — `$rl_key` has four dependants.** Removing the `map` first breaks the config:

1. Repoint the three zones to `$binary_remote_addr` (`api_rl`, `global_rl`, `perip_conn`).
2. Delete `log_format stressdbg` (it references both `$stress_exempt` and `$rl_key`).
3. Delete the `map $stress_exempt $rl_key` block.
4. Delete the `geo $stress_exempt` block.
5. `sudo nginx -t`
6. **`sudo systemctl restart nginx`** — not `reload`.

> **Gotcha, learned in phase 4:** changing a `limit_req_zone` **key** cannot be reloaded. A reload
> fails with
> `[emerg] limit_req "api_rl" uses the "$rl_key" key while previously it used the "$binary_remote_addr" key`
> which lands in `error.log` while nginx keeps serving the OLD config — so it looks like the edit
> did nothing. It cost about six rounds of debugging the first time.

Note that keying `global_rl` and `perip_conn` on `$rl_key` meant the exempt IPs also bypassed the
global 5 r/s cap and the 30-connection limit — not just the API limit.

---

## 5. What is still unfixed, and why it matters

**nginx-generated responses carry no CORS headers.** `s_nginx.txt` defines

```nginx
map $http_origin $cors_allow_origin { … }
```

and the server block sets `$cors_methods`, `$cors_headers`, `$cors_expose` — but **none of these
variables is ever used**. There is no `add_header 'Access-Control-Allow-Origin'` anywhere in the
config. The comment ("Minimal CORS for NGINX-generated responses") describes an intention that
was never implemented.

So **every** nginx-generated status — 429 from `limit_req`, 413 from `client_max_body_size`, 502,
504 — reaches the browser as the same phantom "CORS error", with the real status invisible. The
520 is fixed; the class of bug is not.

Recommended, using the map that already exists:

```nginx
add_header 'Access-Control-Allow-Origin'      $cors_allow_origin always;
add_header 'Access-Control-Allow-Credentials' 'true'             always;
add_header 'Vary'                             'Origin'           always;
```

* `always` is required — without it `add_header` is skipped on exactly the 4xx/5xx that matter.
* The map is missing `embed.resomix.com` and `api-docs.resomix.com`, which the app already allows.
* **nginx `add_header` appends.** If it fires on a successful proxied response that already
  carries FastAPI's header, the browser sees two values and rejects the response. Scope this to
  error responses, or move CORS entirely into nginx — but never let both set it on one response.
* Repeating the security headers inside the `location` block is required if it adds any
  `add_header` of its own (see §3).

**Secondary, worth revisiting separately:** `api_rl` is 3 r/s per IP, and every API call is
preflighted because of the `X-Device-Hash` header, so the effective budget is ~1.5 calls/second.
The preflight cache is keyed by full URL, so search-as-you-type issues a fresh preflight per
keystroke. This did **not** cause this outage, but it is tight for real usage — and once §5's
header fix lands it will at least be visible as a 429 instead of a mystery.

---

## 6. Lessons

1. **Never put a `$binary_*` nginx variable into a header, a log line that reaches a header, or
   anything a parser will read as text.** Beyond the malformed response, an IPv6 address
   containing `0x0D 0x0A` would make this a response-splitting vector.
2. **Temporary diagnostics need an owner and a removal date.** These lines survived the end of
   testing and only became visible when an unrelated variable (the developer's IP) changed.
3. **An error that cannot carry CORS headers cannot be diagnosed from the browser.** §5 is the
   difference between "some infrastructure fault" and "429, you are rate limited".
4. **When the browser says CORS and the server says 200, `curl -D-` the public URL.** It is the
   only observer positioned to see what the edge actually returned.
