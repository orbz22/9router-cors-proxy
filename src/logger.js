"use strict";

const fs = require("fs");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function createLogger({ logLevel = "info", logFile = "" } = {}) {
  const threshold = LEVELS[logLevel] ?? LEVELS.info;
  let stream = null;
  if (logFile) {
    stream = fs.createWriteStream(logFile, { flags: "a" });
    stream.on("error", (e) => process.stderr.write(`log file error: ${e}\n`));
  }

  function emit(level, msg, meta) {
    if ((LEVELS[level] ?? 99) > threshold) return;
    const line =
      JSON.stringify({
        t: new Date().toISOString(),
        level,
        msg,
        ...(meta || {}),
      }) + "\n";
    process.stdout.write(line);
    if (stream) stream.write(line);
  }

  return {
    error: (m, meta) => emit("error", m, meta),
    warn: (m, meta) => emit("warn", m, meta),
    info: (m, meta) => emit("info", m, meta),
    debug: (m, meta) => emit("debug", m, meta),
    close: () => stream && stream.end(),
  };
}

module.exports = { createLogger };
