import { build } from "esbuild";
await build({
    entryPoints: ["src/fivem-entry.mjs"],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: "resources/1nfx_bridge/build/server.cjs",
    external: ["bufferutil", "utf-8-validate"],
    logLevel: "info",
});
