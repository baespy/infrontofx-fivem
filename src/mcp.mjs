import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { topics, getGuidance, resourcePlan } from "./knowledge.mjs";
import { reviewSource, validateManifest } from "./review.mjs";
import { inspectResource } from "./workspace.mjs";
import { fetchNativeIndex, findNatives } from "./natives.mjs";

export function createServer() {
    const server = new McpServer({ name: "infrontofx-fivem", version: "0.1.0" });
    const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
    const tool = (name, description, inputSchema, fn, annotations = readOnly) => server.registerTool(name, { description, inputSchema, annotations }, async (args) => {
        try {
            const result = await fn(args);
            return { content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }] };
        } catch (error) {
            return { isError: true, content: [{ type: "text", text: String(error.message).slice(0, 2000) }] };
        }
    });
    tool("list_infrontofx_topics", "List FiveM guidance topics aligned with infrontofx-skill.", {}, () => topics);
    tool("get_infrontofx_guidance", "Read focused guidance. Existing project instructions and the installed infrontofx-skill remain authoritative for house conventions.", { topic: z.enum(Object.keys(topics)) }, ({ topic }) => getGuidance(topic));
    tool("review_fivem_source", "Pattern-based advisory review of pasted Lua/NUI source. Does not execute code or prove security. Do not send credentials.", { code: z.string().max(128_000), side: z.enum(["client", "server", "nui"]) }, ({ code, side }) => reviewSource(code, side));
    tool("validate_fxmanifest", "Parse a pasted Lua manifest without executing it; inspect declared API, distribution and load order. Lua 5.3-compatible manifest syntax only.", { code: z.string().max(64_000) }, ({ code }) => validateManifest(code));
    tool("inspect_fivem_resource", "Read-only local triage inside INFRONTOFX_RESOURCES_ROOT. Skips secret-named files, private/build/vendor directories and symlinks. Returns findings, not raw files.", { resource: z.string().min(1).max(200) }, ({ resource }) => inspectResource(process.env.INFRONTOFX_RESOURCES_ROOT, resource));
    tool("search_fivem_native", "Search the official GTA and Cfx native indexes by name/hash, with API-set filtering and source links. Network access only to two fixed official index URLs.", { query: z.string().min(2).max(100), side: z.enum(["any", "client", "server"]).default("any"), limit: z.number().int().min(1).max(20).default(8) }, async ({ query, side, limit }) => findNatives(await fetchNativeIndex(), query, side, limit), { ...readOnly, openWorldHint: true });
    tool("plan_fivem_resource", "Return a house-style FiveM resource plan with explicit validation steps. Does not write files.", { name: z.string().min(2).max(64), ui: z.enum(["none", "vanilla", "react", "vue", "svelte"]).default("none") }, ({ name, ui }) => resourcePlan(name, ui));
    server.registerResource("guidance", new ResourceTemplate("infrontofx://guidance/{topic}", { list: async () => ({ resources: Object.keys(topics).map((topic) => ({ uri: `infrontofx://guidance/${topic}`, name: topic, mimeType: "text/markdown" })) }) }), { mimeType: "text/markdown" }, async (uri, { topic }) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: await getGuidance(topic) }] }));
    return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    await createServer().connect(new StdioServerTransport());
}
