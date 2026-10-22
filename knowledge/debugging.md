# FiveM debugging workflow

Record the reproduction, first error/stack, artifact and game build, affected resource, framework version and side: server, client F8 or NUI devtools. Do not change several unrelated systems to hide one symptom.

- Nil Config/FC/controller: verify actual manifest order and exact paths before adding fallback initialization.
- A callback that never completes: compare full names on both ends and inspect the first server exception. RegisterNUICallback must invoke cb once on every exit path.
- Blank NUI: check ui_page/files declarations, built local assets, relative Vite base, browser console and request failures.
- Stuck input: trace close/Escape/death/stop paths and SetNuiFocus release. Test a resource restart while the UI is open.
- Export failures: confirm provider resource state, dependency order, correct side, exact export name, and calling convention.
- Entity issues: distinguish local handles, network IDs, ownership, streaming and routing buckets; a host-only success is insufficient.
- For suspected slow code, capture a comparable profiler workload before and after. A shorter function is not performance evidence.
- Keep temporary diagnostic logging local and bounded; remove it after the fix. Re-run house lint and a behavior test that reproduces the original issue.

Sources:

- https://docs.fivem.net/docs/scripting-manual/debugging/using-profiler/
- https://docs.fivem.net/docs/scripting-manual/nui-development/nui-callbacks/
