import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "wakilpro" },
  // Plain stdout JSON — picked up by Vercel log drains. No transports/worker
  // threads (they break on serverless).
});
