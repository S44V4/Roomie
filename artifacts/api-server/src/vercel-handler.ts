/**
 * Vercel serverless entry point.
 *
 * This file is bundled by esbuild into dist/vercel-handler.mjs and then
 * imported by api/index.mjs (the Vercel Function file at the project root).
 *
 * Vercel's Node.js runtime manages the HTTP server itself — app.listen() is
 * intentionally never called here.  All middleware, session setup, and route
 * registration happen inside app.ts which is imported below.
 */
import app from "./app";

export default app;
