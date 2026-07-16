import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./lib/session";
import { validateMobileToken } from "./lib/mobileAuth";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// Mobile apps send their auth token as "Authorization: Bearer <token>".
// If the session doesn't already have a user, validate the token and
// backfill req.session.userId so all existing route auth checks work for
// both web (cookie session) and mobile (bearer token) without changes.
app.use(async (req, _res, next) => {
  if (!req.session.userId) {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const userId = await validateMobileToken(token).catch(() => null);
      if (userId) req.session.userId = userId;
    }
  }
  next();
});

app.use("/api", router);

// In the combined Koyeb deployment, the frontend's built static files are
// copied alongside this server's bundle and this env var is set so one
// process serves both the API and the website. Unset in the Replit dev
// workflow, where Vite serves the frontend separately — so this is a no-op
// here.
const staticDir = process.env["STATIC_DIR"];
if (staticDir) {
  const resolvedStaticDir = path.resolve(staticDir);
  app.use(express.static(resolvedStaticDir));
  // SPA fallback: any GET that isn't a static file or /api route gets
  // index.html so client-side routes (wouter) resolve on refresh/deep-link.
  // Plain middleware (no path pattern) to stay compatible with Express 5's
  // stricter path-to-regexp syntax.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(resolvedStaticDir, "index.html"));
  });
}

export default app;
