import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export const sections = {
    standard: "SKILL.md",
    architecture: "skills/common/architecture.md",
    style: "skills/common/style.md",
    config: "skills/common/config.md",
    adapters: "skills/common/fc-adapters.md",
    esx: "references/esx-api.md",
    notifications: "references/pnotify-api.md",
    events: "skills/common/events.md",
    runtime: "skills/common/runtime.md",
    security: "skills/common/security.md",
    performance: "skills/common/performance.md",
    networking: "skills/common/networking.md",
    database: "skills/common/database.md",
    natives: "skills/common/natives.md",
    ox_lib: "skills/common/ox-lib.md",
    debugging: "skills/common/debugging.md",
    nui: "skills/ui/nui-bridge.md",
    design: "skills/ui/design-system.md",
    vanilla: "skills/ui/vanilla-ui.md",
    react: "skills/ui/react-vite.md",
    vue_svelte: "skills/ui/vue-svelte.md",
    dui: "skills/ui/dui.md",
    contracts: "rules/contracts.md",
    new_resource: "checklists/new-resource.md",
    review: "checklists/review.md",
};

async function readAllowed(root, relative) {
    if (!root) throw new Error("Set INFRONTOFX_SKILL_ROOT to the installed infrontofx-skill directory.");
    const base = await realpath(root);
    const file = await realpath(path.join(base, relative));
    const inside = path.relative(base, file);
    if (inside.startsWith(`..${path.sep}`) || inside === ".." || path.isAbsolute(inside)) throw new Error("Skill reference escaped its configured root.");
    const info = await stat(file);
    if (!info.isFile() || info.size > 64_000) throw new Error("Skill reference must be a file no larger than 64 KB.");
    const text = await readFile(file, "utf8");
    if (Buffer.byteLength(text) > 64_000) throw new Error("Skill reference grew beyond the read budget.");
    return { file: relative, sha256: createHash("sha256").update(text).digest("hex"), text };
}

export async function readSkill(root, section) {
    if (!Object.hasOwn(sections, section)) throw new Error("Unknown skill section.");
    return { section, ...await readAllowed(root, sections[section]) };
}

export async function searchSkill(root, query, limit = 6) {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 8);
    if (!terms.length) throw new Error("Use a non-blank literal search query.");
    const matches = [];
    let readBytes = 0;
    for (const section of Object.keys(sections)) {
        let reference;
        try { reference = await readSkill(root, section); } catch (error) {
            if (error.code === "ENOENT") continue;
            throw error;
        }
        readBytes += Buffer.byteLength(reference.text);
        if (readBytes > 512_000) throw new Error("Skill search exceeded its 512 KB read budget.");
        const lines = reference.text.split(/\r?\n/);
        for (let index = 0; index < lines.length; index++) {
            const lower = lines[index].toLowerCase();
            const score = terms.filter((term) => lower.includes(term)).length;
            if (score) matches.push({ section, file: reference.file, line: index + 1, score, excerpt: lines.slice(Math.max(0, index - 1), index + 3).join("\n").slice(0, 1200) });
        }
    }
    matches.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line);
    return { query, matches: matches.slice(0, Math.max(1, Math.min(limit, 12))), totalMatches: matches.length, note: "Literal term search across approved installed-skill references only. Read the selected section for complete context." };
}

export const workflows = {
    create: ["standard", "architecture", "adapters", "new_resource"],
    debug: ["debugging", "runtime", "events"],
    security: ["security", "events", "runtime", "adapters"],
    performance: ["performance", "networking", "database"],
    database: ["database", "adapters", "security"],
    nui: ["nui", "design", "events"],
    integration: ["contracts", "adapters", "runtime"],
};

export async function composeContext(root, workflow, ui = "none") {
    if (!Object.hasOwn(workflows, workflow)) throw new Error("Unknown development workflow.");
    const selected = new Set(workflows[workflow]);
    if (ui !== "none") {
        selected.add("nui");
        selected.add(({ react: "react", vue: "vue_svelte", svelte: "vue_svelte", vanilla: "vanilla" })[ui]);
    }
    const references = [];
    let remaining = 32_000;
    for (const section of selected) {
        const reference = await readSkill(root, section);
        const text = reference.text.slice(0, remaining);
        references.push({ ...reference, text, truncated: text.length < reference.text.length });
        remaining -= text.length;
        if (remaining <= 0) break;
    }
    return {
        workflow, ui, references,
        missingSections: [...selected].filter((section) => !references.some((reference) => reference.section === section)),
        nextSteps: ["Inspect the target resource and its manifest before editing.", "Use these installed-skill sections as house references; follow project/user instructions when they differ.", "Confirm API compatibility against the installed framework and official sources.", "Implement the requested behavior, not unrelated refactors.", "Run house lint and meaningful behavior tests; distinguish Node/simulated tests from live FiveM evidence."],
        note: "No file changes or server actions were performed. Truncated references can be read individually with get_infrontofx_skill.",
    };
}

const templateFiles = ["fxmanifest.lua", "config/config.lua", "config/config.shop.lua", "config/function/config.function.client.lua", "config/function/config.function.server.lua", "core/cl_main.lua", "core/sv_main.lua", "html/index.html", "html/css/style.css", "html/js/app.js"];

export async function previewTemplate(root, name) {
    if (!/^[a-z0-9][a-z0-9_]{1,63}$/.test(name)) throw new Error("Use a lowercase resource name, 2–64 characters.");
    const controller = name.replace(/^(?:infrontofx|1nfx)_/, "").split("_").filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
    if (!/^[A-Z][A-Za-z0-9]*$/.test(controller)) throw new Error("Resource name must produce a PascalCase controller; use a descriptive name after the prefix.");
    const files = {};
    let bytes = 0;
    for (const file of templateFiles) {
        const reference = await readAllowed(root, `templates/resource/${file}`);
        bytes += Buffer.byteLength(reference.text);
        if (bytes > 128_000) throw new Error("Template preview exceeded 128 KB.");
        files[file] = reference.text.replaceAll("TemplateServer", `${controller}Server`).replace(/\bTemplate\b/g, controller).replaceAll("infrontofx_template", name);
    }
    return { name, controller, files, kind: "Installed canonical shop example with vanilla NUI", note: "Preview only: no files were written. This is an example, not an arbitrary feature generator or a tested production resource. Adapt gameplay, FC, inventory/account behavior, permissions and persistence to the target server. For React/Vue/Svelte, retain the Lua bridge and use the corresponding skill guidance." };
}
