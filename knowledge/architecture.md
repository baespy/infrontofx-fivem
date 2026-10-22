# infrontofx / FiveM architecture

Use the installed infrontofx-skill and the target resource's AGENTS.md for house conventions. This is supporting context, not permission to rewrite unrelated files.

- ESX resources use the ESX export header and GetCurrentResourceName at the top of client/server Lua files.
- One Name / NameServer controller per side; colon methods own runtime state. Single-system logic belongs in core/cl_main.lua and core/sv_main.lua.
- Config.General and Config.Text live in config/config.lua. Read them directly; do not add core/sh_config.lua or normalization layers.
- Integration and owner hooks belong in config/function/config.function.client.lua or .server.lua through FC. UI frameworks do not replace this boundary.
- Load ox_lib, Config, side-specific FC, then core. Runtime UI assets are local build output.
- Reusable framework-neutral transport libraries may use JavaScript and do not need ESX. Consuming ESX resources still use FC and the house controller.
- No money, inventory or resource-control operation is authorized by connecting a WebSocket.

Sources: https://docs.fivem.net/docs/scripting-reference/resource-manifest/resource-manifest/ and https://github.com/baespy/infrontofx-skill
