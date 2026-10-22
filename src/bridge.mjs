import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const part = /^[a-zA-Z0-9_-]{1,64}$/;
const topicPattern = /^[a-zA-Z0-9_-]{1,64}:[a-zA-Z0-9_-]{1,64}$/;
function equalSecret(value, expected) {
    const left = Buffer.from(value ?? "");
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
}

export function createBridge({ token, host = "127.0.0.1", port = 30125, origins = [], maxClients = 16, authTimeoutMs = 3000, heartbeatMs = 30_000 }) {
    if (typeof token !== "string" || token.length < 32) throw new Error("Set a server-only bridge token with at least 32 characters.");
    if (!Number.isInteger(maxClients) || maxClients < 1 || maxClients > 128) throw new Error("maxClients must be 1–128.");
    const peers = new Map();
    const publishers = new Map();
    const allowedOrigins = new Set(origins);
    const http = createServer((_request, response) => {
        response.writeHead(404, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
        response.end("Not found");
    });
    http.headersTimeout = 5000;
    http.requestTimeout = 5000;
    const ws = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
    http.on("upgrade", (request, socket, head) => {
        const origin = request.headers.origin;
        if (request.url !== "/live" || peers.size >= maxClients || (origin !== undefined && !allowedOrigins.has(origin))) {
            socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
            return;
        }
        const authorization = request.headers.authorization;
        const authenticated = typeof authorization === "string" && authorization.startsWith("Bearer ") && equalSecret(authorization.slice(7), token);
        if (authorization !== undefined && !authenticated) {
            socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
            return;
        }
        ws.handleUpgrade(request, socket, head, (client) => ws.emit("connection", client, authenticated));
    });
    ws.on("connection", (client, authenticated) => {
        const state = { authenticated, subscriptions: new Set(), alive: true, window: Date.now(), messages: 0, authTimer: undefined };
        peers.set(client, state);
        client.on("error", () => client.terminate());
        const send = (data) => {
            if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
        };
        if (authenticated) send({ type: "ready", protocol: 1 });
        else state.authTimer = setTimeout(() => client.terminate(), authTimeoutMs);
        client.on("pong", () => { state.alive = true; });
        client.on("close", () => {
            clearTimeout(state.authTimer);
            peers.delete(client);
        });
        client.on("message", (raw, binary) => {
            if (binary) return client.close(1003, "JSON text only");
            if (Date.now() - state.window >= 1000) {
                state.window = Date.now();
                state.messages = 0;
            }
            if (++state.messages > 10) return client.close(1008, "Rate limit");
            let message;
            try { message = JSON.parse(raw.toString()); } catch { return client.close(1007, "Invalid JSON"); }
            if (!message || typeof message !== "object" || Array.isArray(message)) return client.close(1008, "Invalid message");
            if (!state.authenticated) {
                if (message.type !== "auth" || typeof message.token !== "string" || !equalSecret(message.token, token)) return client.close(1008, "Unauthorized");
                state.authenticated = true;
                clearTimeout(state.authTimer);
                return send({ type: "ready", protocol: 1 });
            }
            if (!["subscribe", "unsubscribe"].includes(message.type) || typeof message.topic !== "string" || !topicPattern.test(message.topic)) return client.close(1008, "Only telemetry subscriptions are allowed");
            if (message.type === "unsubscribe") state.subscriptions.delete(message.topic);
            else {
                if (state.subscriptions.size >= 8 && !state.subscriptions.has(message.topic)) return client.close(1008, "Subscription limit");
                state.subscriptions.add(message.topic);
            }
            send({ type: "subscribed", topics: [...state.subscriptions] });
        });
    });
    const heartbeat = setInterval(() => {
        for (const [client, state] of peers) {
            if (!state.alive) client.terminate();
            else {
                state.alive = false;
                client.ping();
            }
        }
    }, heartbeatMs);
    heartbeat.unref();
    let closing = false;
    let starting;
    let closeTask;
    return {
        async listen() {
            if (closing) throw new Error("Bridge is closed.");
            starting = new Promise((resolve, reject) => {
                http.once("error", reject);
                http.listen(port, host, () => {
                    http.removeListener("error", reject);
                    resolve();
                });
            });
            await starting;
            return http.address();
        },
        publish(owner, topic, data) {
            if (closing || !part.test(owner) || !part.test(topic)) return false;
            if (!publishers.has(owner)) {
                if (publishers.size >= 128) return false;
                publishers.set(owner, { at: Date.now(), count: 0, topics: new Set() });
            }
            const publisher = publishers.get(owner);
            if (Date.now() - publisher.at >= 1000) {
                publisher.at = Date.now();
                publisher.count = 0;
            }
            if (++publisher.count > 50 || (publisher.topics.size >= 16 && !publisher.topics.has(topic))) return false;
            let payload;
            try { payload = JSON.stringify({ type: "telemetry", topic: `${owner}:${topic}`, at: Date.now(), data }); } catch { return false; }
            if (Buffer.byteLength(payload) > 8192) return false;
            publisher.topics.add(topic);
            for (const [client, state] of peers) {
                if (!state.authenticated || !state.subscriptions.has(`${owner}:${topic}`) || client.readyState !== WebSocket.OPEN) continue;
                if (client.bufferedAmount > 131_072) client.terminate();
                else client.send(payload);
            }
            return true;
        },
        removeOwner(owner) {
            publishers.delete(owner);
            for (const state of peers.values()) {
                for (const topic of state.subscriptions) if (topic.startsWith(`${owner}:`)) state.subscriptions.delete(topic);
            }
        },
        stats() {
            return { connections: peers.size, authenticated: [...peers.values()].filter((state) => state.authenticated).length, publishers: publishers.size };
        },
        close() {
            if (closeTask) return closeTask;
            closing = true;
            closeTask = (async () => {
            await starting?.catch(() => {});
            clearInterval(heartbeat);
            for (const [client, state] of peers) {
                clearTimeout(state.authTimer);
                client.terminate();
            }
            publishers.clear();
            await new Promise((resolve) => ws.close(resolve));
            if (http.listening) await new Promise((resolve) => http.close(resolve));
            })();
            return closeTask;
        },
    };
}
