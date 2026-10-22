# FiveM performance and lifecycle

- Measure comparable resmon/profiler captures for idle, active, player-count and restart scenarios. Record game/artifact build, duration and workload. Do not infer gains from code appearance.
- Prefer points/zones and state-change notifications to idle scanning. Wait(0) is for active frame work only.
- Bound outbound bytes, retry count, send queues, callback maps, database batches and per-tick work. Backpressure must drop or disconnect according to an explicit policy.
- Send to relevant players and buckets. Avoid high-frequency global broadcasts and full snapshots for one changed value.
- Keep indexes for repeated server lookups; parameterize SQL and use transactions for atomic invariants. Do not blindly cache authoritative inventory or money.
- Release entities, blips, zones, focus, timers, sockets and subscriptions on stop/drop. Resource restart must not leave orphan connections or pending promises.
- Reconnect with capped exponential backoff and jitter. Never treat reconnect as permission to replay non-idempotent actions.

Source: https://docs.fivem.net/docs/scripting-manual/debugging/using-profiler/
