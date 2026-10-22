import WebSocket from "ws";

const token = process.env.INFRONTOFX_BRIDGE_TOKEN;
if (!token) throw new Error("Set INFRONTOFX_BRIDGE_TOKEN; never put tokens in URLs.");
const endpoint = process.env.INFRONTOFX_BRIDGE_URL ?? "ws://127.0.0.1:30125/live";
const url = new URL(endpoint);
if (url.protocol !== "wss:" && !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Use wss for a remote bridge.");
let socket;
let timer;
let failures = 0;
let stopped = false;
function connect() {
    socket = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` }, handshakeTimeout: 5000, maxPayload: 16384 });
    socket.on("message", (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type === "ready") {
            failures = 0;
            socket.send(JSON.stringify({ type: "subscribe", topic: "1nfx_telemetry:status" }));
        } else if (message.type === "telemetry") console.log(JSON.stringify(message));
    });
    socket.on("error", () => {});
    socket.on("close", () => {
        if (stopped) return;
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5)) + Math.random() * 500;
        timer = setTimeout(connect, delay);
    });
}
process.on("SIGINT", () => {
    stopped = true;
    clearTimeout(timer);
    socket?.terminate();
});
connect();
