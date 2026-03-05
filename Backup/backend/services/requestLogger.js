// backend/services/requestLogger.js
"use strict";

const crypto = require("crypto");
const { makeLogger } = require("./logger");

const log = makeLogger();

function requestLogger() {
  return function (req, res, next) {
    const reqId =
      req.headers["x-request-id"] ||
      crypto.randomBytes(8).toString("hex");

    req.reqId = String(reqId);
    const start = process.hrtime.bigint();

    res.setHeader("x-request-id", req.reqId);

    res.on("finish", () => {
      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1e6;

      log.info("http_request", {
        reqId: req.reqId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs: Number(ms.toFixed(2)),
        ip: req.ip,
      });
    });

    next();
  };
}

module.exports = { requestLogger };
