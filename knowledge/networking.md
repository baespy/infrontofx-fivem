# FiveM entities and state replication

- An entity handle is local to one runtime. A network ID is used to refer to a networked entity across machines; resolve it on the receiving side and verify the entity still exists before native calls.
- State bags have shallow serialization semantics. Prefer intentional flat keys over repeatedly reading/modifying nested tables through the bag interface.
- State bags are replicated state, not a trusted command channel. Resolve ownership and sensitive values on the server; validate permissions independently of client-set state.
- Routing buckets isolate networked game state but do not replace application checks. Confirm the caller and target are in the intended bucket for proximity interactions.
- Scope updates to actual recipients. Never broadcast player-private data or frequent entity snapshots to every client by default.
- Streamed entities may be unavailable locally. Cleanup and updates must tolerate ownership migration and stop/drop without inventing replacement entities each frame.
- Test with multiple real clients, ownership migration, bucket changes and resource restart. Node mocks do not validate OneSync replication.

Sources:

- https://docs.fivem.net/docs/scripting-manual/networking/state-bags/
- https://docs.fivem.net/docs/scripting-manual/networking/ids/
