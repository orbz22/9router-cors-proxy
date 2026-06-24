"use strict";

// Centralized configuration. All values overridable via environment variables
// (loaded from a .env file by index.js if present). Sensible defaults match a
// standard local 9router install.

function parseOrigins(raw) {
  if (!raw) return ["https://pivot.claude.ai", "https://claude.ai"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(name, def) {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${name}: ${v}`);
  return n;
}

const config = {
  listenHost: process.env.LISTEN_HOST || "127.0.0.1",
  listenPort: num("LISTEN_PORT", 20129),
  upstreamHost: process.env.UPSTREAM_HOST || "127.0.0.1",
  upstreamPort: num("UPSTREAM_PORT", 20128),
  // Allowed browser origins. "*" allows any origin but disables credentialed CORS.
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  // Upstream socket/response timeout (ms).
  upstreamTimeoutMs: num("UPSTREAM_TIMEOUT_MS", 120000),
  logLevel: (process.env.LOG_LEVEL || "info").toLowerCase(),
  logFile: process.env.LOG_FILE || "", // empty = stdout only
};

module.exports = config;
