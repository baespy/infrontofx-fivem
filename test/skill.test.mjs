import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sections, readSkill, searchSkill, composeContext, previewTemplate } from "../src/skill.mjs";

async function fixture() {
    const root = await mkdtemp(path.join(tmpdir(), "infrontofx-skill-test-"));
    for (const [section, file] of Object.entries(sections)) {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await writeFile(path.join(root, file), `# ${section}\nRule for ${section}.\n`);
    }
    return root;
}

test("skill retrieval reflects changed installed files and reports matching content digests", async () => {
    const root = await fixture();
    try {
        const before = await readSkill(root, "database");
        await writeFile(path.join(root, sections.database), "A new conditional transaction rule.");
        const after = await readSkill(root, "database");
        assert.notEqual(before.sha256, after.sha256);
        assert.match(after.text, /conditional transaction/);
        const matches = await searchSkill(root, "conditional transaction", 1);
        assert.equal(matches.matches[0].section, "database");
        assert.equal(matches.matches[0].line, 1);
        await assert.rejects(readSkill(root, "../anything"), /Unknown/);
        await assert.rejects(searchSkill(root, "  "), /non-blank/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test("context selects task/framework references without unrelated sections", async () => {
    const root = await fixture();
    try {
        const result = await composeContext(root, "database", "vue");
        const selected = result.references.map((reference) => reference.section);
        assert.ok(selected.includes("database"));
        assert.ok(selected.includes("vue_svelte"));
        assert.ok(selected.includes("nui"));
        assert.ok(!selected.includes("dui"));
        assert.deepEqual(result.missingSections, []);
        assert.ok(result.references.reduce((count, reference) => count + reference.text.length, 0) <= 32_000);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test("skill references reject escaping symlinks and oversized files", async () => {
    const root = await fixture();
    const outside = await mkdtemp(path.join(tmpdir(), "infrontofx-outside-"));
    try {
        await mkdir(path.join(outside, "common"));
        await writeFile(path.join(outside, "common/style.md"), "outside");
        await rm(path.join(root, "skills"), { recursive: true });
        await symlink(outside, path.join(root, "skills"), process.platform === "win32" ? "junction" : "dir");
        await assert.rejects(readSkill(root, "style"), /escaped/);
        await writeFile(path.join(root, "SKILL.md"), "x".repeat(64_001));
        await assert.rejects(readSkill(root, "standard"), /64 KB/);
    } finally {
        await rm(root, { recursive: true, force: true });
        await rm(outside, { recursive: true, force: true });
    }
});

test("template preview preserves canonical source while transforming names and never writes generated resources", async () => {
    const root = await fixture();
    const files = ["fxmanifest.lua", "config/config.lua", "config/config.shop.lua", "config/function/config.function.client.lua", "config/function/config.function.server.lua", "core/cl_main.lua", "core/sv_main.lua", "html/index.html", "html/css/style.css", "html/js/app.js"];
    try {
        for (const file of files) {
            const full = path.join(root, "templates/resource", file);
            await mkdir(path.dirname(full), { recursive: true });
            await writeFile(full, "TemplateServer = {}; Template = {}; infrontofx_template");
        }
        const result = await previewTemplate(root, "1nfx_test_shop");
        assert.equal(result.controller, "TestShop");
        assert.match(result.files["core/sv_main.lua"], /TestShopServer/);
        assert.match(result.files["html/index.html"], /1nfx_test_shop/);
        assert.match(await readFile(path.join(root, "templates/resource/core/sv_main.lua"), "utf8"), /TemplateServer/);
        await assert.rejects(previewTemplate(root, "../escape"), /lowercase/);
        await assert.rejects(readFile(path.join(root, "1nfx_test_shop/fxmanifest.lua")), { code: "ENOENT" });
    } finally { await rm(root, { recursive: true, force: true }); }
});
