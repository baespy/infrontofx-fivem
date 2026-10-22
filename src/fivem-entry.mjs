import { createBridge } from "./bridge.mjs";

const resource = GetCurrentResourceName();
const token = GetConvar("infrontofx_bridge_token", "");
const allowed = new Set(GetConvar("infrontofx_bridge_publishers", "1nfx_telemetry").split(",").map((name) => name.trim()));
let bridge;
try {
    bridge = createBridge({
        token,
        host: GetConvar("infrontofx_bridge_host", "127.0.0.1"),
        port: GetConvarInt("infrontofx_bridge_port", 30125),
        origins: GetConvar("infrontofx_bridge_origins", "").split(",").map((origin) => origin.trim()).filter(Boolean),
        maxClients: GetConvarInt("infrontofx_bridge_max_clients", 16),
    });
    bridge.listen().then(() => console.log(`[${resource}] read-only telemetry listening`)).catch((error) => {
        console.error(`[${resource}] listen failed: ${error.message}`);
        bridge.close();
    });
} catch (error) {
    console.error(`[${resource}] disabled: ${error.message}`);
}

exports("publish", (topic, data) => {
    const owner = GetInvokingResource();
    if (!bridge || typeof owner !== "string" || !allowed.has(owner)) return false;
    return bridge.publish(owner, topic, data);
});

on("onResourceStop", (name) => {
    if (!bridge) return;
    if (name === resource) bridge.close();
    else bridge.removeOwner(name);
});
