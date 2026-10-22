# FiveM trust boundaries

- Networked events can be invoked by hostile clients. Keep internal events local with AddEventHandler; register network handlers only for deliberate public endpoints.
- Capture local src = source before yielding. Payloads convey intent, never authoritative identity, money, rewards, ownership, jobs or permissions.
- Resolve sensitive values from server state. Validate types, lengths, finite numeric ranges, distance and routing bucket as relevant.
- Bound action rates and concurrent mutations. After a yield, verify the same player identity still occupies the source ID before applying changes.
- Idempotency is required when a request can be retried. A transport acknowledgement is not evidence that a reward was durably applied.
- Server-only credentials must not appear in shared/client scripts, files, NUI bundles, replicated convars or resource metadata distributed to clients.
- WebSocket peers and NUI callbacks are external input. Authentication and authorization are separate. Keep telemetry read-only unless an explicit command protocol is designed and tested.
- Pattern scanners only identify review candidates. Trace complete handlers and test hostile inputs before reporting an audit result.

Source: https://docs.fivem.net/docs/developers/server-security/
