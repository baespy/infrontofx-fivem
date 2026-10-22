import { test } from "node:test";
import assert from "node:assert/strict";
import { validateManifest, reviewSource } from "../src/review.mjs";
import { findNatives } from "../src/natives.mjs";
import { resourcePlan } from "../src/knowledge.mjs";

test("manifest parser handles both Lua call styles without evaluating code", () => {
    const result = validateManifest(`fx_version "cerulean"\ngame("gta5")\nserver_scripts { "config/function/config.function.server.lua", "core/sv_main.lua" }`);
    assert.equal(result.valid, true);
    assert.deepEqual(result.findings, []);
    assert.deepEqual(result.declarations.game, ["gta5"]);
});

test("manifest parser reports syntax, exposed credentials and incorrect load order", () => {
    assert.equal(validateManifest("this is not lua {").valid, false);
    const result = validateManifest(`fx_version "cerulean"\ngames { "gta5" }\nfiles { "config/credentials.server.json" }\nserver_scripts { "core/sv_main.lua", "config/function/config.function.server.lua" }`);
    assert.equal(result.valid, false);
    assert.ok(result.findings.some((finding) => finding.rule === "secret-surface"));
    assert.ok(result.findings.some((finding) => finding.rule === "load-order"));
});

test("review returns line-numbered review candidates with a limitation statement", () => {
    const result = reviewSource('local x = 1\nlib.notify({})\nWait(0)', "client");
    assert.equal(result.findings[0].line, 2);
    assert.match(result.assurance, /does not prove/);
});

test("native lookup respects API sets, exact ranking and bounded result count", () => {
    const index = [{ name: "GET_PLAYER_PED_EXTRA", hash: "0x1", apiset: "client" }, { name: "GET_PLAYER_PED", hash: "0x2", apiset: "server" }, { name: "GET_PLAYER_PED", hash: "0x3", apiset: "client" }];
    assert.equal(findNatives(index, "get_player_ped", "server", 1).results[0].hash, "0x2");
    assert.equal(findNatives(index, "get_player_ped", "any", 1).results[0].name, "GET_PLAYER_PED");
    assert.throws(() => findNatives(index, "   "));
});

test("plans support house resource prefixes and reject path injection", () => {
    assert.equal(resourcePlan("1nfx_inventory", "react").name, "1nfx_inventory");
    assert.throws(() => resourcePlan("../bad", "react"));
});
