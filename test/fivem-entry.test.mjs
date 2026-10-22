import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

test("bundled entry enforces the caller allowlist with simulated FiveM globals and fails closed without credentials", async () => {
    const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/fivem-entry.mjs", import.meta.url))], bundle: true, platform: "node", target: "node22", format: "cjs", write: false, external: ["bufferutil", "utf-8-validate"] });
    const code = bundle.outputFiles[0].text;
    let owner = "unlisted_resource";
    const registered = new Map();
    const handlers = new Map();
    let started;
    const listening = new Promise((resolve) => { started = resolve; });
    const context = {
        require: createRequire(import.meta.url), Buffer, process, URL, setTimeout, clearTimeout, setInterval, clearInterval,
        console: { log: () => started(), error: (message) => { throw new Error(message); } },
        GetCurrentResourceName: () => "1nfx_bridge",
        GetConvar: (key, fallback) => key === "infrontofx_bridge_token" ? "test-token-with-at-least-32-characters" : fallback,
        GetConvarInt: (key, fallback) => key === "infrontofx_bridge_port" ? 0 : fallback,
        GetInvokingResource: () => owner,
        exports: (name, fn) => registered.set(name, fn),
        on: (name, fn) => handlers.set(name, fn),
    };
    runInNewContext(code, context);
    await listening;
    try {
        assert.equal(registered.get("publish")("status", {}), false);
        owner = "1nfx_telemetry";
        assert.equal(registered.get("publish")("status", {}), true);
        owner = null;
        assert.equal(registered.get("publish")("status", {}), false);
    } finally {
        handlers.get("onResourceStop")("1nfx_bridge");
    }
    const disabled = new Map();
    runInNewContext(code, { ...context, GetConvar: (_key, fallback) => fallback, exports: (name, fn) => disabled.set(name, fn), console: { log() {}, error() {} } });
    owner = "1nfx_telemetry";
    assert.equal(disabled.get("publish")("status", {}), false);
});
