import app from "./app";
import { logger } from "./lib/logger";

// On Vercel the HTTP layer is managed by the runtime — app.listen() must not
// be called there.  Only start the local HTTP server when running outside Vercel.
if (process.env.VERCEL !== "1") {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}
