import { readFile } from "node:fs/promises";

export const topics = {
    architecture: "Controller structure, Config, FC boundaries, manifest load order",
    security: "Server authority, event trust boundaries, rewards and identity",
    performance: "Profiling, bounded work, scoped updates and lifecycle cleanup",
    nui: "NUI bridge, React, Vue, Svelte, focus and safe rendering",
    realtime: "Authenticated telemetry, backpressure and reconnect semantics",
};

export async function getGuidance(topic) {
    if (!Object.hasOwn(topics, topic)) throw new Error("Unknown guidance topic");
    return readFile(new URL(`../knowledge/${topic}.md`, import.meta.url), "utf8");
}

export function resourcePlan(name, ui) {
    if (!/^[a-z0-9][a-z0-9_]{1,63}$/.test(name)) throw new Error("Use a lowercase resource name, 2–64 characters");
    const files = ["fxmanifest.lua", "config/config.lua", "config/function/config.function.client.lua", "config/function/config.function.server.lua", "core/cl_main.lua", "core/sv_main.lua"];
    if (ui !== "none") files.push("interface-dev/package.json", "interface-dev/src/main." + ({ react: "tsx", vue: "ts", svelte: "ts", vanilla: "js" }[ui]), "html/index.html");
    return {
        name, ui, files,
        loadOrder: ["@ox_lib/init.lua", "config/config.lua", "side-specific config/function", "side-specific core"],
        dependencies: ["es_extended", "ox_lib"],
        rules: ["Follow infrontofx-skill", "All integrations through FC", "No core/sh_config.lua", "Server derives rewards, identity and permissions", "uiReady and one cb per NUI callback", "Build UI assets locally; do not ship node_modules"],
        validation: ["Run house lint", "Inspect diff", "Test hostile events and concurrent mutations", "Test resource restart and player disconnect", "Measure comparable resmon/profiler captures before claiming performance improvements"],
        note: "This is a plan, not generated files or a claim that the resource is tested.",
    };
}
