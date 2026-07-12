import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ---------------------------------------------------------------------------
// Session secret — must be set explicitly in production.
// ---------------------------------------------------------------------------
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  throw new Error(
    "SESSION_SECRET environment variable must be set in production. " +
      "Generate one with: openssl rand -hex 32",
  );
}

const PgSession = connectPgSimple(session);

// Trust the Vercel edge proxy so that secure cookies can be set
app.set('trust proxy', 1);

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

const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    store: new PgSession({
      pool,
    }),
    // Fall back to an insecure dev secret locally; production always requires
    // the env var (enforced by the guard above).
    secret: sessionSecret ?? "roomie-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // secure: true is required for cookies to be sent over HTTPS.
      // On Vercel all traffic is HTTPS, so this must be true in production.
      secure: isProduction,
      // "lax" is correct for same-origin Vercel deployments (frontend and
      // backend share the same domain).
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  }),
);

app.use("/api", router);

export default app;

