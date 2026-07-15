import express from "express";
import path from "path";
import { config } from "./config";
import { PushListenerHandle } from "./pushListener";
import { VapidKeys } from "./vapidStore";
import { addSubscriber, removeSubscriberByEndpoint, StoredSubscription } from "./subscribersStore";

const PUBLIC_DIR = path.join(__dirname, "..", "public");

export function createHealthServer(
  getListener: () => PushListenerHandle | null,
  vapidKeys: VapidKeys
) {
  const app = express();
  app.use(express.json());

  // Serves the installable clan PWA (index.html, manifest.json, sw.js,
  // icons, siren audio) as static files.
  app.use(express.static(PUBLIC_DIR));

  // The clan name is baked into the page via a tiny template swap rather
  // than a full templating engine, since this is the only dynamic value.
  app.get("/", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  app.get("/api/config", (_req, res) => {
    res.json({ clanName: config.clanName, vapidPublicKey: vapidKeys.publicKey });
  });

  app.post("/api/subscribe", (req, res) => {
    const sub = req.body as StoredSubscription;
    if (!sub || !sub.endpoint || !sub.keys) {
      res.status(400).json({ error: "Invalid subscription payload" });
      return;
    }
    const result = addSubscriber(sub);
    console.log(
      `Subscriber ${result.added ? "added" : "already registered"} (total: ${result.total}).`
    );
    res.status(201).json(result);
  });

  app.post("/api/unsubscribe", (req, res) => {
    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) {
      res.status(400).json({ error: "Missing endpoint" });
      return;
    }
    removeSubscriberByEndpoint(endpoint);
    res.status(200).json({ removed: true });
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
