import { realpath, lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { reviewSource, validateManifest } from "./review.mjs";

const skip = new Set([".git", "node_modules", "dist", "build", "stream", "vendor", "fonts", "private"]);
const secretName = /credential|secret|\.env|\.pem$|\.key$|token|password/i;
export async function resolveResource(root, resource) {
    if (!root) throw new Error("Set INFRONTOFX_RESOURCES_ROOT to explicitly allow local resource inspection.");
    if (!resource || path.isAbsolute(resource)) throw new Error("Use a relative resource path.");
    const base = await realpath(root);
    const candidate = await realpath(path.resolve(base, resource));
    const relative = path.relative(base, candidate);
    if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) throw new Error("Resource must be strictly inside the configured root.");
    if (!(await lstat(candidate)).isDirectory()) throw new Error("Expected a resource directory.");
    return candidate;
}

export async function inspectResource(root, resource) {
    const base = await resolveResource(root, resource);
    let bytes = 0;
    let count = 0;
    let entries = 0;
    const findings = [];
    let manifestFound = false;
    const walk = async (dir, depth = 0) => {
        if (depth > 12) throw new Error("Resource nesting limit exceeded.");
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            if (++entries > 2000) throw new Error("Resource entry limit exceeded.");
            if (skip.has(entry.name) || secretName.test(entry.name) || entry.isSymbolicLink()) continue;
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(file, depth + 1);
                continue;
            }
            if (!entry.isFile() || !/\.(lua|js|ts|tsx|jsx|vue|svelte|html)$/.test(entry.name)) continue;
            const canonical = await realpath(file);
            const relative = path.relative(base, canonical);
            if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("File escaped resource root.");
            const stat = await lstat(canonical);
            if (++count > 200 || stat.size > 256_000 || (bytes += stat.size) > 2_000_000) throw new Error("Inspection budget exceeded: 200 files, 256 KB per file, 2 MB total.");
            const code = await readFile(canonical, "utf8");
            const name = relative.split(path.sep).join("/");
            const manifest = name === "fxmanifest.lua";
            manifestFound ||= manifest;
            const side = /(?:^|\/)(?:sv_|server)/.test(name) || name.endsWith(".server.lua") ? "server" : "client";
            const result = manifest ? validateManifest(code) : reviewSource(code, side);
            findings.push(...result.findings.map((finding) => ({ file: name, ...finding })));
        }
    };
    await walk(base);
    if (!manifestFound) findings.push({ file: "fxmanifest.lua", severity: "error", rule: "manifest-missing", message: "No root fxmanifest.lua found." });
    return { resource, filesScanned: count, bytesScanned: bytes, findings: findings.slice(0, 300), findingsTruncated: findings.length > 300, note: "Read-only static triage; secret-named/private/build/vendor files and symlinks are skipped. Source contents are not returned. This is not a full audit." };
}
