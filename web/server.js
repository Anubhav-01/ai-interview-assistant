// Minimal static server for the landing page (zero dependencies).
// Serves web/public on the PORT Railway provides.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];

  if (url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  // sanitize path - no traversal
  const safe = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, safe === "/" || safe === "\\" ? "index.html" : safe);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA-ish fallback to index for unknown routes
      return fs.readFile(path.join(PUBLIC_DIR, "index.html"), (err2, index) => {
        if (err2) {
          res.writeHead(404);
          return res.end("Not found");
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(index);
      });
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Landing page listening on :${PORT}`));

// graceful shutdown for Railway deploys
process.on("SIGTERM", () => server.close(() => process.exit(0)));
