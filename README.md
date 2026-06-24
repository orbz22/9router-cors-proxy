# 9router CORS Proxy

A tiny, dependency-free local proxy that lets the **Claude-for-Office (Word) add-in**
talk to a local **9router** gateway.

## Why

The Word add-in runs in a browser context with origin `https://pivot.claude.ai`.
9router's auth middleware returns `401` for **every** request method — including the
CORS preflight `OPTIONS` — so the browser blocks the call with:

```
Access to fetch at 'http://localhost:20128/v1/models' from origin
'https://pivot.claude.ai' has been blocked by CORS policy: No
'Access-Control-Allow-Origin' header is present on the requested resource.
```

This proxy sits in front of 9router and:

- Answers `OPTIONS` preflight locally (`204` + CORS headers) — never forwarded to auth.
- Injects `Access-Control-Allow-Origin` on every proxied response.
- Collapses an accidental doubled `/v1/v1/` path into `/v1/`.

```
Word add-in ──> :20129 (this proxy) ──> :20128 (9router)
 origin pivot.claude.ai      adds CORS          unchanged
```

## Requirements

- Node.js >= 18 (uses only the standard library)
- A running 9router gateway on `127.0.0.1:20128`

## Run

```sh
npm start
```

Or directly:

```sh
node src/index.js
```

Health check:

```sh
npm run health
# or
curl http://127.0.0.1:20129/__proxy_health
```

## Configure

Copy `.env.example` to `.env` and edit. All values are optional.

| Variable | Default | Meaning |
|---|---|---|
| `LISTEN_HOST` | `127.0.0.1` | Address the proxy binds to (keep local). |
| `LISTEN_PORT` | `20129` | Proxy port. |
| `UPSTREAM_HOST` | `127.0.0.1` | 9router host. |
| `UPSTREAM_PORT` | `20128` | 9router port. |
| `ALLOWED_ORIGINS` | `https://pivot.claude.ai,https://claude.ai` | Origins allowed credentialed CORS. `*` = any (no credentials). |
| `UPSTREAM_TIMEOUT_MS` | `120000` | Upstream response timeout. |
| `LOG_LEVEL` | `info` | `error` \| `warn` \| `info` \| `debug`. |
| `LOG_FILE` | _(empty)_ | Optional append-log path; stdout always used. |

## Point the Word add-in here

In the Claude add-in gateway settings:

- **Gateway URL:** `http://localhost:20129`  (the add-in appends `/v1` itself; the
  proxy also auto-collapses a doubled `/v1/v1`)
- **Token:** unchanged

Then reload the add-in pane.

## Auto-start at logon (Windows)

```sh
scripts\install-autostart.cmd     # register hidden task, start now
scripts\uninstall-autostart.cmd   # remove it
```

The task runs `scripts\run-hidden.vbs`, which launches Node with no console window.

## Security notes

- Binds to `127.0.0.1` only — not reachable off the machine.
- Credentialed CORS is granted only to origins in `ALLOWED_ORIGINS`. Unknown origins
  receive no `Access-Control-Allow-Origin` and are blocked by the browser.
- This proxy adds **no** authentication of its own; 9router still enforces its API key
  on all non-preflight requests.

## License

MIT
