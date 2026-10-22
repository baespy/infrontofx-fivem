import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveResource, inspectResource } from "../src/workspace.mjs";

test("local inspection rejects traversal and escaping junctions, skips secrets and bounds file reads", async () => {
    const temp = await mkdtemp(path.join(tmpdir(), "infrontofx-"));
    try {
        const root = path.join(temp, "resources");
        const good = path.join(root, "good");
        const outside = path.join(temp, "outside");
        await mkdir(good, { recursive: true });
        await mkdir(outside);
        await writeFile(path.join(good, "fxmanifest.lua"), 'fx_version "cerulean"\ngame "gta5"');
        await writeFile(path.join(good, "credentials.lua"), "lib.notify({})");
        await symlink(outside, path.join(root, "escape"), process.platform === "win32" ? "junction" : "dir");
        await assert.rejects(resolveResource(undefined, "good"), /explicitly allow/);
        await assert.rejects(resolveResource(root, "../outside"), /strictly inside/);
        await assert.rejects(resolveResource(root, "escape"), /strictly inside/);
        await assert.rejects(resolveResource(root, "."), /strictly inside/);
        const result = await inspectResource(root, "good");
        assert.equal(result.filesScanned, 1);
        assert.deepEqual(result.findings, []);
        await writeFile(path.join(good, "huge.lua"), "x".repeat(256_001));
        await assert.rejects(inspectResource(root, "good"), /budget exceeded/);
    } finally {
        await rm(temp, { recursive: true, force: true });
    }
});
