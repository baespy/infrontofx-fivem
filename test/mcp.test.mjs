import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("real stdio MCP handshake, discovery, resource reads, review and invalid inputs", async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL("../src/mcp.mjs", import.meta.url))], stderr: "pipe" });
    const client = new Client({ name: "infrontofx-test", version: "1.0.0" });
    try {
        await client.connect(transport);
        const { tools } = await client.listTools();
        assert.equal(tools.length, 11);
        assert.ok(tools.every((tool) => tool.annotations.readOnlyHint));
        const guidance = await client.callTool({ name: "get_infrontofx_guidance", arguments: { topic: "nui" } });
        assert.match(guidance.content[0].text, /Vue/);
        const resources = await client.listResources();
        assert.equal(resources.resources.length, 8);
        const resource = await client.readResource({ uri: "infrontofx://guidance/security" });
        assert.match(resource.contents[0].text, /Server-only credentials/);
        const plan = await client.callTool({ name: "plan_fivem_resource", arguments: { name: "../bad", ui: "vue" } });
        assert.equal(plan.isError, true);
        const validPlan = await client.callTool({ name: "plan_fivem_resource", arguments: { name: "1nfx_test", ui: "vue" } });
        assert.equal(JSON.parse(validPlan.content[0].text).ui, "vue");
        const review = await client.callTool({ name: "review_fivem_source", arguments: { side: "nui", code: "node.innerHTML = player.name" } });
        assert.equal(JSON.parse(review.content[0].text).findings[0].rule, "html-sink");
        const refused = await client.callTool({ name: "inspect_fivem_resource", arguments: { resource: "../outside" } });
        assert.equal(refused.isError, true);
        const noSkill = await client.callTool({ name: "get_infrontofx_skill", arguments: { section: "standard" } });
        assert.equal(noSkill.isError, true);
        assert.match(noSkill.content[0].text, /INFRONTOFX_SKILL_ROOT/);
    } finally {
        await client.close();
    }
});
