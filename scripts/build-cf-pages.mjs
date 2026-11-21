import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["vite", "build"], {
  VITE_STATIC_PREVIEW: "true",
});
run("npm", ["--prefix", "mobile", "run", "build:web"]);

const dist = path.join(root, "dist");
mkdirSync(path.join(dist, "app"), { recursive: true });
cpSync(path.join(dist, "index.html"), path.join(dist, "__landing_shell"));
cpSync(path.join(dist, "app", "index.html"), path.join(dist, "app", "__app_shell"));

const esbuild = (await import("esbuild")).default;
const nodeBuiltins = [
  "assert","async_hooks","buffer","child_process","cluster","constants","crypto","dgram","diagnostics_channel",
  "dns","domain","events","fs","fs/promises","http","http2","https","inspector","module","net","os","path",
  "perf_hooks","process","punycode","querystring","readline","stream","string_decoder","sys","timers","tls",
  "tty","url","util","v8","vm","wasi","worker_threads","zlib",
];
const builtinFilter = new RegExp(`^(${nodeBuiltins.map((name) => name.replace("/", "\\/")).join("|")})$`);
const bundle = await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["workers/pages-worker.ts"],
  bundle: true,
  minify: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  mainFields: ["main", "module"],
  conditions: ["node", "import", "default"],
  outfile: "dist/_worker.js",
  legalComments: "none",
  logLimit: 0,
  banner: {
    js: `
import * as node_buffer from "node:buffer";
import * as node_crypto from "node:crypto";
import * as node_events from "node:events";
import * as node_fs from "node:fs";
import * as node_http from "node:http";
import * as node_https from "node:https";
import * as node_net from "node:net";
import * as node_os from "node:os";
import * as node_path from "node:path";
import * as node_process from "node:process";
import * as node_punycode from "node:punycode";
import * as node_stream from "node:stream";
import * as node_tls from "node:tls";
import * as node_url from "node:url";
import * as node_util from "node:util";
import * as node_zlib from "node:zlib";
import { Buffer as __ShimBuffer } from "node:buffer";
if (globalThis.Buffer === undefined) globalThis.Buffer = __ShimBuffer;
const __node_mods = {
  buffer: node_buffer, "node:buffer": node_buffer,
  crypto: node_crypto, "node:crypto": node_crypto,
  events: node_events, "node:events": node_events,
  fs: node_fs, "node:fs": node_fs,
  http: node_http, "node:http": node_http,
  https: node_https, "node:https": node_https,
  net: node_net, "node:net": node_net,
  os: node_os, "node:os": node_os,
  path: node_path, "node:path": node_path,
  process: node_process, "node:process": node_process,
  punycode: node_punycode, "node:punycode": node_punycode,
  stream: node_stream, "node:stream": node_stream,
  tls: node_tls, "node:tls": node_tls,
  url: node_url, "node:url": node_url,
  util: node_util, "node:util": node_util,
  zlib: node_zlib, "node:zlib": node_zlib,
};
function require(name) {
  const mod = __node_mods[name];
  if (!mod) throw Error('Dynamic require of "' + name + '" is not supported');
  const d = mod.default;
  if (typeof d === "function") {
    const out = Object.assign(d, mod);
    if ((name === "events" || name === "node:events") && !out.EventEmitter) out.EventEmitter = d;
    return out;
  }
  if (d && typeof d === "object") return Object.assign({}, mod, d);
  return mod;
}
`,
  },
  plugins: [{
    name: "node-builtin-prefix",
    setup(buildApi) {
      buildApi.onResolve({ filter: builtinFilter }, (args) => ({ path: `node:${args.path}`, external: true }));
      buildApi.onResolve({ filter: /^node:/ }, (args) => ({ path: args.path, external: true }));
    },
  }],
});
if (bundle.errors?.length) process.exit(1);

console.log("Cloudflare Pages build ready in dist/");
