// Local verification server: the actual exported pages and existing Vercel API handlers.
import "dotenv/config";
import express from "express";
import waitlist from "../api/waitlist/index.ts";
import path from "node:path";
import mobile from "../api/mobile.ts";
import health from "../api/health.ts";
import status from "../api/devnet/status.ts";
import quotes from "../api/quotes.ts";
import unsigned from "../api/transactions/unsigned.ts";
const app = express();
app.use(express.json());
app.all("/api/waitlist", (req, res, next) => {
  // The Vercel adapter assigns a normalized IP on Node's request. Express
  // exposes a getter, so give this local request a writable own property.
  Object.defineProperty(req, "ip", { value: req.ip, writable: true, configurable: true });
  void waitlist(req, res).catch(next);
});
app.all("/api/mobile", mobile);
app.all("/api/health", health);
app.all("/api/devnet/status", status);
app.all("/api/quotes", quotes);
app.all("/api/transactions/unsigned", unsigned);
app.use("/api", (_req, res) => { res.status(404).json({ error: "NOT_FOUND" }); });
const root = path.resolve("dist");
app.use(express.static(root, { redirect: false }));
app.get(["/app", "/app/*"], (_req, res) => res.sendFile(path.join(root, "index.html")));
app.get("*", (_req, res) => res.sendFile(path.join(root, "index.html")));
app.listen(5002, "127.0.0.1", () => console.log("Local web preview ready at http://127.0.0.1:5002"));
