import * as esbuild from "esbuild";
import { WebSocketServer } from "ws";
import { readFileSync } from "fs";

const clients = new Set();

// Create WebSocket server for live reload
const wss = new WebSocketServer({ port: 5174 });

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("Live reload client connected");

  ws.on("close", () => {
    clients.delete(ws);
  });
});

function notifyReload() {
  for (const client of clients) {
    if (client.readyState === 1) {
      // 1 = OPEN
      client.send("reload");
    }
  }
}

// Plugin to inject live reload script
const liveReloadPlugin = {
  name: "live-reload",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0) {
        console.log("Build completed, notifying clients...");
        notifyReload();
      }
    });
  },
};

async function startDevServer() {
  const ctx = await esbuild.context({
    entryPoints: ["src/main.tsx"],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    sourcemap: true,
    outfile: "public/dist/bundle.js",
    tsconfig: "tsconfig.json",
    plugins: [liveReloadPlugin],
    banner: {
      js: `
(() => {
  const ws = new WebSocket("ws://localhost:5174");
  ws.onmessage = () => {
    console.log("Reloading due to file change...");
    location.reload();
  };
  ws.onclose = () => {
    console.log("Live reload disconnected. Retrying in 1s...");
    setTimeout(() => location.reload(), 1000);
  };
})();
      `.trim(),
    },
  });

  await ctx.watch();

  const { host, port } = await ctx.serve({
    servedir: "public",
    port: 5173,
    host: "127.0.0.1",
  });

  console.log(`\n🚀 Dev server running at http://${host}:${port}`);
  console.log(`📡 Live reload enabled on ws://localhost:5174\n`);
}

startDevServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
