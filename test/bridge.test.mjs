import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import WebSocket from "ws";
import { createBridge } from "../src/bridge.mjs";

const token = "infrontofx-test-token-01234567890123456789";
async function fixture(options = {}) {
    const bridge = createBridge({ token, port: 0, authTimeoutMs: 100, ...options });
    const address = await bridge.listen();
    const url = `ws://127.0.0.1:${address.port}/live`;
    return { bridge, url };
}
function next(client) {
    return once(client, "message").then(([raw]) => JSON.parse(raw.toString()));
}
async function connect(url, options = {}) {
    const client = new WebSocket(url, options);
    const ready = next(client);
    await once(client, "open");
    return { client, ready };
}

test("authenticated peers receive only subscribed owner-scoped telemetry; no remote mutations", async () => {
    const { bridge, url } = await fixture();
    try {
        const { client, ready } = await connect(url, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal((await ready).type, "ready");
        const subscribed = next(client);
        client.send(JSON.stringify({ type: "subscribe", topic: "1nfx_telemetry:status" }));
        await subscribed;
        const update = next(client);
        assert.equal(bridge.publish("1nfx_telemetry", "status", { players: 12 }), true);
        assert.equal((await update).data.players, 12);
        assert.equal(bridge.publish("bad:owner", "status", {}), false);
        assert.equal(bridge.publish("1nfx_telemetry", "status", { data: "x".repeat(9000) }), false);
        bridge.removeOwner("1nfx_telemetry");
        assert.equal(bridge.stats().publishers, 0);
        const closed = once(client, "close");
        client.send(JSON.stringify({ type: "execute", command: "restart anything" }));
        assert.equal((await closed)[0], 1008);
    } finally { await bridge.close(); }
});

test("browser first-frame auth supports only explicitly allowed origins", async () => {
    const { bridge, url } = await fixture({ origins: ["https://admin.example.test"], authTimeoutMs: 1000 });
    try {
        const client = new WebSocket(url, { origin: "https://admin.example.test" });
        await once(client, "open");
        const ready = next(client);
        client.send(JSON.stringify({ type: "auth", token }));
        assert.equal((await ready).type, "ready");
        const blocked = new WebSocket(url, { origin: "https://evil.example.test" });
        const error = await once(blocked, "error");
        assert.match(error[0].message, /403/);
        const wrong = new WebSocket(url, { headers: { Authorization: "Bearer wrong" } });
        assert.match((await once(wrong, "error"))[0].message, /401/);
    } finally { await bridge.close(); }
});

test("unauthenticated timeout, max clients and oversized frames are enforced", async () => {
    const { bridge, url } = await fixture({ maxClients: 1, authTimeoutMs: 200 });
    try {
        const idle = new WebSocket(url);
        await once(idle, "open");
        const idleClosed = once(idle, "close");
        const excess = new WebSocket(url);
        assert.match((await once(excess, "error"))[0].message, /403/);
        await idleClosed;
        const { client, ready } = await connect(url, { headers: { Authorization: `Bearer ${token}` } });
        await ready;
        const closed = once(client, "close");
        client.send("x".repeat(9000));
        assert.equal((await closed)[0], 1009);
    } finally { await bridge.close(); }
});

test("publisher rate and topic count are bounded; stop releases the listening port", async () => {
    const { bridge, url } = await fixture();
    const port = new URL(url).port;
    for (let i = 0; i < 16; i++) assert.equal(bridge.publish("resource", `topic_${i}`, {}), true);
    assert.equal(bridge.publish("resource", "overflow", {}), false);
    for (let i = 0; i < 50; i++) bridge.publish("other", "status", {});
    assert.equal(bridge.publish("other", "status", {}), false);
    await bridge.close();
    const replacement = createBridge({ token, port: Number(port) });
    await replacement.listen();
    await replacement.close();
});

test("closing during startup is idempotent and prevents further publishing", async () => {
    const bridge = createBridge({ token, port: 0 });
    const starting = bridge.listen();
    await Promise.all([starting, bridge.close(), bridge.close()]);
    assert.equal(bridge.publish("resource", "status", {}), false);
    await assert.rejects(bridge.listen(), /closed/);
});
