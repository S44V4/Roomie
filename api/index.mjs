/**
 * Vercel Serverless Function entry point.
 *
 * Vercel picks up any file inside /api as a serverless function.
 * This file imports the Express app bundle produced by esbuild
 * (artifacts/api-server/dist/vercel-handler.mjs) and re-exports it as the
 * default handler.  Vercel's Node.js runtime calls the default export with
 * (req, res) — Express is fully compatible with this interface.
 *
 * NOTE: app.listen() is intentionally NOT called here.  The Vercel runtime
 * manages the HTTP server; calling listen() would throw in this context.
 */
import app from "../artifacts/api-server/dist/vercel-handler.mjs";

export default app;
