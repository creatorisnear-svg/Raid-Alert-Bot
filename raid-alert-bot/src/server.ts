import express from "express";
import { config } from "./config";
import { PushListenerHandle } from "./pushListener";

export function createHealthServer(getListener: () => PushListenerHandle | null) {
  const app = express();

  // Root path -- handy default target for uptime monitors that just hit "/".
  app.get("/", (_req, res) => {
    res.status(200).send("raid-alert-bot is running");
  });

  // Dedicated health endpoint -- point UptimeRobot (or similar) at this.
  app.get("/health", (_req, res) => {
    const listener = getListener();
    const connected = listener?.isConnected() ?? false;
    const lastEventAt = listener?.lastEventAt() ?? null;
    res.status(connected ? 200 : 503).json({
      status: connected ? "ok" : "listener_disconnected",
      pushListenerConnected: connected,
      lastAlertReceivedAt: lastEventAt ? lastEventAt.toISOString() : null,
      pingTarget: config.pingTarget,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  return app.listen(config.port, "0.0.0.0", () => {
    console.log(`Health server listening on port ${config.port}`);
  });
}
