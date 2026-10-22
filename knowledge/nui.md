# FiveM NUI / React / Vue / Svelte

- Use Vite source projects separately from shipped html assets. Set a relative asset base and ship compiled JS/CSS/fonts locally.
- Every framework uses the same bridge: messages are { action, data }; the page sends uiReady; Lua calls each callback cb exactly once, including rejected requests.
- Build callback URLs from GetParentResourceName() and HTTPS. A UI close request must release SetNuiFocus and clear transient state.
- Validate action and payload at the Lua boundary. Browser state is presentation, never authority for prices, items, permissions or ownership.
- React: subscribe in an effect and remove the same handler on cleanup. Avoid stale closures and duplicate development subscriptions.
- Vue: subscribe onMounted and remove onUnmounted. Use text interpolation; never v-html for player content.
- Svelte: subscribe through onMount and return a cleanup function. Avoid raw HTML for player content.
- Bootstrap UI state only after readiness; resend authoritative state when a resource/UI reloads. Debounce purely visual inputs without hiding requests that mutate server state.
- Sanitize neither by hand-built HTML escapes nor by trusting an event origin alone. Use textContent or framework text bindings and validate the payload shape.
- Test focus, Escape, resource restart, UI reload and display scaling in actual FiveM CEF.

Source: https://docs.fivem.net/docs/scripting-manual/nui-development/nui-callbacks/
