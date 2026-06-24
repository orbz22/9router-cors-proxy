"use strict";

// 9router CORS sidecar proxy (production entrypoint).
//
// Purpose: the Claude-for-Office (Word) add-in runs in a browser context with
// origin https://pivot.claude.ai and talks to a local 9router gateway. 9router's
// auth middleware 401s every request method including the CORS preflight (OPTIONS),
// so the browser blocks the fetch with "No 'Access-Control-Allow-Origin' header".
//
// This proxy sits in front of 9router and:
//   - answers OPTIONS preflight locally (204 + CORS headers), never forwarding to auth
//   - injects Access-Control-Allow-Origin on every proxied response
//   - collapses an accidental doubled "/v1/v1/" path into "/v1/"
//
// No external dependencies. Bound to 127.0.0.1 by default.

const http = require("http");
const fs = require("fs");
const path = require("path");

// Minimal .env loader (no dependency). Lines: KEY=VALUE, # comments ignored.
(function loadDotEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
})();

const config = require("./config");
const { createLogger } = require("./logger");

const log = createLogger(config);

// Resolve the CORS Allow-Origin value for a given request origin.
function resolveAllowOrigin(origin) {
  if (config.allowedOrigins.includes("*")) return { value: "*", credentials: false };
  if (origin && config.allowedOrigins.includes(origin)) {
    return { value: origin, credentials: true };
  }
  // Origin not allowed: omit ACAO (browser will block; intentional).
  return { value: null, credentials: false };
}

function corsHeaders(req) {
  const origin = req.headers["origin"];
  const { value, credentials } = resolveAllowOrigin(origin);
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      req.headers["access-control-request-headers"] || "*",
    "Access-Control-Expose-Headers": "*",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (value) headers["Access-Control-Allow-Origin"] = value;
  if (credentials) headers["Access-Control-Allow-Credentials"] = "true";
  return headers;
}

const server = http.createServer((req, res) => {
  const start = Date.now();

  // Local health endpoint — never forwarded.
  if (req.method === "GET" && req.url === "/__proxy_health") {
    const body = JSON.stringify({ status: "ok", upstream: `${config.upstreamHost}:${config.upstreamPort}` });
    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders(req) });
    res.end(body);
    return;
  }

  // CORS preflight — answer locally so 9router auth never sees it.
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    res.end();
    log.debug("preflight", { url: req.url, origin: req.headers["origin"] });
    return;
  }

  // Collapse accidental "/v1/v1/..." -> "/v1/..."
  const upstreamPath = req.url.replace(/^\/v1\/v1\//, "/v1/");

  const upstreamReq = http.request(
    {
      host: config.upstreamHost,
      port: config.upstreamPort,
      method: req.method,
      path: upstreamPath,
      headers: { ...req.headers, host: `${config.upstreamHost}:${config.upstreamPort}` },
      timeout: config.upstreamTimeoutMs,
    },
    (upstreamRes) => {
      const headers = { ...upstreamRes.headers };
      // Strip upstream CORS headers to avoid duplicates, then inject ours.
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase().startsWith("access-control-")) delete headers[k];
      }
      Object.assign(headers, corsHeaders(req));
      res.writeHead(upstreamRes.statusCode || 502, headers);
      upstreamRes.pipe(res);
      upstreamRes.on("end", () =>
        log.info("proxied", {
          method: req.method,
          path: upstreamPath,
          status: upstreamRes.statusCode,
          ms: Date.now() - start,
        })
      );
    }
  );

  upstreamReq.on("timeout", () => {
    log.warn("upstream timeout", { path: upstreamPath });
    upstreamReq.destroy(new Error("upstream timeout"));
  });

  upstreamReq.on("error", (err) => {
    log.error("upstream error", { path: upstreamPath, error: String(err) });
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json", ...corsHeaders(req) });
      res.end(JSON.stringify({ error: "proxy_upstream_error", detail: String(err) }));
    } else {
      res.destroy();
    }
  });

  req.pipe(upstreamReq);
});

server.on("clientError", (err, socket) => {
  log.warn("client error", { error: String(err) });
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(config.listenPort, config.listenHost, () => {
  log.info("listening", {
    addr: `http://${config.listenHost}:${config.listenPort}`,
    upstream: `http://${config.upstreamHost}:${config.upstreamPort}`,
    allowedOrigins: config.allowedOrigins,
  });
});

// Graceful shutdown.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("shutdown", { signal });
  server.close(() => {
    log.close();
    process.exit(0);
  });
  // Force-exit if connections linger.
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (e) => {
  log.error("uncaughtException", { error: String(e && e.stack ? e.stack : e) });
});
