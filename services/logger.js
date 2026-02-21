// backend/services/logger.js
"use strict";

function nowIso() {
  return new Date().toISOString();
}

function base(fields) {
  return {
    ts: nowIso(),
    service: "lorcana-backend",
    ...fields,
  };
}

function emit(level, msg, fields) {
  const line = JSON.stringify(base({ level, msg, ...fields }));
  // stderr para warn/error, stdout para info/debug
  if (level === "warn" || level === "error") console.error(line);
  else console.log(line);
}

function makeLogger(opts = {}) {
  const level = String(opts.level || process.env.LOG_LEVEL || "info").toLowerCase();
  const enabled = process.env.LOG_DISABLED === "1" ? false : true;

  const rank = { debug: 10, info: 20, warn: 30, error: 40 };
  const min = rank[level] ?? 20;

  function ok(lv) {
    return enabled && (rank[lv] ?? 999) >= min;
  }

  return {
    debug: (msg, fields = {}) => ok("debug") && emit("debug", msg, fields),
    info: (msg, fields = {}) => ok("info") && emit("info", msg, fields),
    warn: (msg, fields = {}) => ok("warn") && emit("warn", msg, fields),
    error: (msg, fields = {}) => ok("error") && emit("error", msg, fields),
  };
}

module.exports = { makeLogger };
