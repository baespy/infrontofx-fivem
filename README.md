# infrontofx / FiveM

A local FiveM development MCP, house-style guidance, and an authenticated realtime telemetry bridge. Built around [infrontofx-skill](https://github.com/baespy/infrontofx-skill).

[คู่มือเริ่มใช้ภาษาไทย](docs/START.th.md)

This is an initial development release. MCP protocol and transport behavior are tested in Node; the resources still need live FXServer validation. No performance or production-readiness claim is made.

## What's included

| Component | Purpose |
| --- | --- |
| Local stdio MCP | Seven read-only tools: guidance, source triage, manifest parsing, bounded resource inspection, official native lookup and resource planning |
| Five guidance resources | Architecture, security, performance, React/Vue/Svelte NUI, realtime integration |
| `1nfx_bridge` | Server-side WebSocket telemetry with authentication, origin allowlist, publisher ownership, limits, heartbeat and stop cleanup |
| `1nfx_telemetry` | ESX + FC example publishing player/resource counts; no player identifiers |
| CLI subscriber | A reconnecting client for verifying the telemetry feed |

This repository is an original implementation. It does not bundle isle-admin, chatz or ws_lib. It does not supply a web admin panel, player management, support inbox, arbitrary server commands, money/item mutations, SQL access or a hosted public MCP endpoint.

## Install

Requires Node.js 22+ and npm. The bridge resource explicitly selects FXServer's Node 22 runtime.

```sh
git clone https://github.com/baespy/infrontofx-fivem.git
cd infrontofx-fivem
npm ci
npm run check
```

## Connect the MCP

Use your client's stdio MCP configuration with absolute paths:

```json
{
  "mcpServers": {
    "infrontofx-fivem": {
      "command": "node",
      "args": ["/absolute/path/infrontofx-fivem/src/mcp.mjs"],
      "env": {
        "INFRONTOFX_RESOURCES_ROOT": "/absolute/path/to/resources"
      }
    }
  }
}
```

`INFRONTOFX_RESOURCES_ROOT` is optional. Without it, local resource inspection is disabled; pasted-source and reference tools still work. On Windows use `C:/...` paths or escape backslashes in JSON.

For Codex CLI, replace the two absolute paths:

```sh
codex mcp add infrontofx-fivem --env INFRONTOFX_RESOURCES_ROOT=/absolute/path/to/resources -- node /absolute/path/infrontofx-fivem/src/mcp.mjs
codex mcp list
```

Restart the client/session after changing MCP configuration. An installed infrontofx-skill and project instructions determine house conventions; MCP guidance supports them. Native documentation is reference data and must not be treated as instructions.

Example requests:

- "Use infrontofx-skill and inspect the 1nfx_inventory resource; separate confirmed problems from pattern matches."
- "Look up GET_PLAYER_PED for the server API set and show the official source."
- "Plan a Vue NUI resource using FC and the standard readiness handshake."

## MCP tools

| Tool | Behavior |
| --- | --- |
| `list_infrontofx_topics` | Discover focused guidance |
| `get_infrontofx_guidance` | Read one topic |
| `review_fivem_source` | Pattern-based triage of pasted code, with line numbers |
| `validate_fxmanifest` | Parse declarations without executing Lua |
| `inspect_fivem_resource` | Read a resource strictly inside the configured root; no source contents returned |
| `search_fivem_native` | Search official GTA + Cfx indexes with side filters and source links |
| `plan_fivem_resource` | Plan vanilla, React, Vue, Svelte or no-UI resources |

Manifest parsing accepts Lua 5.3-compatible declaration syntax, not every possible Lua 5.4 construct. It does not expand globs, prove file existence or evaluate dynamic declarations. Source review is advisory, can match comments/strings, and cannot prove security or correctness. Inspection skips symlinks, secret-named files and private/build/vendor directories; it stops at 200 source files, 256 KB per file, 2 MB total and bounded directory depth. Do not submit credentials through pasted-code tools.

## FiveM telemetry

1. Run `npm run build`.
2. Copy `resources/1nfx_bridge` and `resources/1nfx_telemetry` into your development FXServer resources directory. The bridge build output must be included.
3. Generate a random token with at least 32 characters and put it in a private server configuration file. Use `set`, never `setr`, to avoid replication.
4. Load that private configuration before starting the resources:

```cfg
set infrontofx_bridge_token "REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS"
set infrontofx_bridge_host "127.0.0.1"
set infrontofx_bridge_port "30125"
set infrontofx_bridge_publishers "1nfx_telemetry"
set infrontofx_bridge_max_clients "16"
ensure es_extended
ensure 1nfx_bridge
ensure 1nfx_telemetry
```

Do not commit the private configuration. The text above is an example, not a working secret. A non-local deployment needs a TLS reverse proxy and explicit firewall/origin settings. Browser origins are denied by default; set `infrontofx_bridge_origins` to comma-separated exact origins only if a browser client is needed.

To verify from a terminal, set `INFRONTOFX_BRIDGE_TOKEN` in that terminal's environment, then run:

```sh
node scripts/telemetry-client.mjs
```

The default URL is `ws://127.0.0.1:30125/live`. Set `INFRONTOFX_BRIDGE_URL` for another endpoint; remote clients require `wss://`. Do not place credentials in a URL or browser storage.

Other Lua resources publish through their FC adapter, after adding their resource name to the publisher allowlist:

```lua
FC.PublishStatus = function(data)
    return exports[Config.General.bridge_resource]:publish("status", data)
end
```

Clients receive topics scoped as `resourceName:topicName`. Messages are ephemeral; reconnecting clients must resubscribe and wait for the next snapshot. There is no delivery guarantee or action replay.

## WebSocket protocol

Connect to `/live`. Non-browser clients authenticate with an `Authorization: Bearer ...` header. Browser clients must have an allowed Origin and send an initial `{"type":"auth","token":"..."}` frame within three seconds. The server replies `{"type":"ready","protocol":1}`.

Then send `{"type":"subscribe","topic":"1nfx_telemetry:status"}`. Unsubscribe uses the same topic and `type: "unsubscribe"`. Any other message type is rejected. No inbound game commands exist.

Limits: 16 total peers by default, 8 subscriptions per peer, 8 KB frames, 10 incoming messages/second, 16 topics and 50 publish attempts/second per resource, 128 publishers, 128 KB buffered output. Overflow is rejected or the slow peer is disconnected; no unbounded queue is retained. A shared read-only token can read all published topics; do not publish private player data to this feed.

## Verification and release gate

```sh
npm test
npm run build
node scripts/verify-native.mjs
```

Tests exercise a real stdio MCP client handshake, source/manifest review, path traversal and junction rejection, secret-file skipping, inspection budgets, websocket auth/origins, payload and connection limits, publisher bounds and port release on shutdown. The native smoke test requires internet and is separate from offline CI.

Before using on a live server: verify the export caller identity in FXServer, stop/start both resources, connect/disconnect clients, check malformed messages and slow peers, and measure actual resmon/profiler data. Node tests do not substitute for those checks. Keep this on a development server until those checks pass.

## Sources and design notes

Researched 2026-10-22:

- [Cfx server event security](https://docs.fivem.net/docs/developers/server-security/)
- [Cfx resource manifest and Node runtime selection](https://docs.fivem.net/docs/scripting-reference/resource-manifest/resource-manifest/)
- [Cfx NUI callbacks](https://docs.fivem.net/docs/scripting-manual/nui-development/nui-callbacks/)
- [Official GTA native index](https://runtime.fivem.net/doc/natives.json) and [Cfx native index](https://runtime.fivem.net/doc/natives_cfx.json)
- [Official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [ws API and backpressure controls](https://github.com/websockets/ws/blob/master/doc/ws.md)
- [OpenAI MCP configuration example](https://developers.openai.com/learn/docs-mcp)

The references discussed with the user — fivem-mcp, ws_lib, isle-admin and chatz — informed the scope comparison. They are not dependencies, and no compatibility with them is implied.
