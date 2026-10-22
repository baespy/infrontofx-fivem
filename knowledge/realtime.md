# FiveM realtime integration

The included 1nfx_bridge is a server-side, read-only telemetry transport. It does not provide player management, RCON, SQL or arbitrary command execution.

- Keep credentials server-side with set, never setr. Browser clients authenticate in the first frame rather than placing tokens in URLs or localStorage.
- Bind locally by default and terminate public TLS at a reverse proxy. Explicitly allow browser origins; non-browser clients use a bearer header.
- Cap total connections, unauthenticated lifetime, incoming frame size, publish size, topics, update rate and send buffer. Disconnect slow consumers rather than allowing unbounded queues.
- Topic names are scoped to the publishing FiveM resource. Consuming Lua resources call exports only through FC.
- Subscription messages can subscribe to existing telemetry only. They cannot mutate game state.
- Telemetry is ephemeral: messages are not replayed after disconnect. Resubscribe after reconnect and await the next snapshot.
- Restart cleanup must close sockets and remove publishers, subscriptions and timers. Resource names and tokens are not interchangeable permission systems.

Sources: https://github.com/websockets/ws/blob/master/doc/ws.md and https://docs.fivem.net/docs/developers/server-security/
