/**
 * revEarth — play the built game offline.
 *
 *   node serve.mjs            serves ./dist on http://localhost:5190
 *   node serve.mjs 8080       on another port
 *
 * Node built-ins only: no npm install, no network. The game is fully bundled
 * into ./dist by `npm run build`, and it makes no requests beyond this server.
 * (A server is needed rather than opening index.html directly, because browsers
 * only allow ES modules and WebGPU on http://localhost, not on file://.)
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const port = Number(process.argv[2]) || 5190;

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".map": "application/json",
    ".wasm": "application/wasm",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
        let file = normalize(join(root, path));
        if (file !== root && !file.startsWith(root + sep)) {
            res.writeHead(403).end();
            return;
        }
        if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, "index.html");
        const body = await readFile(file);
        res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
        res.end(body);
    } catch {
        res.writeHead(404).end("Not found");
    }
}).listen(port, "127.0.0.1", () => {
    console.log(`revEarth is running at http://localhost:${port}  (Ctrl+C to stop)`);
});
