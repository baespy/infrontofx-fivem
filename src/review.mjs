import luaparse from "luaparse";

export function validateManifest(code) {
    let ast;
    try {
        ast = luaparse.parse(code, { luaVersion: "5.3", encodingMode: "x-user-defined" });
    } catch (error) {
        return { valid: false, findings: [{ severity: "error", rule: "manifest-syntax", message: error.message }], note: "Static Lua 5.3-compatible manifest parser; Lua 5.4-only syntax is not supported. Nothing is executed." };
    }
    const calls = [];
    const visit = (node) => {
        if (!node || typeof node !== "object") return;
        if (["CallExpression", "StringCallExpression", "TableCallExpression"].includes(node.type) && node.base?.type === "Identifier") calls.push(node);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === "object") visit(value);
        }
    };
    visit(ast);
    const literalValues = (node) => {
        if (!node || typeof node !== "object") return [];
        if (node.type === "StringLiteral") return [node.value];
        return Object.values(node).flatMap((value) => Array.isArray(value) ? value.flatMap(literalValues) : literalValues(value));
    };
    const declarations = {};
    for (const call of calls) {
        const values = literalValues(call.arguments ?? call.argument);
        (declarations[call.base.name] ??= []).push(...values);
    }
    const findings = [];
    if (!declarations.fx_version?.includes("cerulean")) findings.push({ severity: "warning", rule: "fx-version", message: "Expected a literal fx_version cerulean declaration; dynamic declarations need manual review." });
    if (![...(declarations.game ?? []), ...(declarations.games ?? [])].includes("gta5")) findings.push({ severity: "warning", rule: "game", message: "Expected a literal gta5 declaration for FiveM." });
    if (declarations.lua54) findings.push({ severity: "info", rule: "lua54", message: "lua54 is deprecated; Lua 5.4 is now the default according to Cfx documentation." });
    const clientSurface = ["shared_script", "shared_scripts", "client_script", "client_scripts", "file", "files"].flatMap((key) => declarations[key] ?? []);
    if (clientSurface.some((path) => /credential|secret|\.env|server\.json/i.test(path))) findings.push({ severity: "error", rule: "secret-surface", message: "A client-distributed path appears to contain server credentials. Inspect the file list before shipping." });
    for (const key of ["client_scripts", "server_scripts"]) {
        const paths = declarations[key] ?? [];
        const fc = paths.findIndex((path) => path.startsWith("config/function/"));
        const core = paths.findIndex((path) => path.startsWith("core/"));
        if (fc >= 0 && core >= 0 && fc > core) findings.push({ severity: "warning", rule: "load-order", message: `${key}: FC must load before core.` });
    }
    return { valid: !findings.some((finding) => finding.severity === "error"), declarations, findings, note: "Static advisory checks. Dynamic Lua, glob expansion, file existence and runtime behavior require separate validation." };
}

export function reviewSource(code, side) {
    const findings = [];
    const add = (line, rule, message, severity = "warning") => findings.push({ line, rule, message, severity });
    const lines = code.split(/\r?\n/);
    lines.forEach((text, index) => {
        const line = index + 1;
        if (/\blib\.(notify|progressBar|progressCircle|showTextUI|hideTextUI|registerContext|showContext|inputDialog|alertDialog)\b/.test(text)) add(line, "house-ui", "Route UI integrations through FC or the resource NUI.");
        if (/innerHTML\s*[+]?=|insertAdjacentHTML|dangerouslySetInnerHTML|v-html\s*=|\{@html/.test(text)) add(line, "html-sink", "Untrusted content must use text bindings or textContent.");
        if (/TriggerClientEvent\s*\([^,]+,\s*-1\b/.test(text)) add(line, "broadcast", "Confirm every player needs this update; prefer scoped recipients.");
        if (/\bWait\s*\(\s*0\s*\)/.test(text)) add(line, "frame-work", "Keep this only for active frame work; measure with the profiler.");
        if (/discord(?:app)?\.com\/api\/webhooks\//i.test(text) && side !== "server") add(line, "client-secret", "A webhook appears in client-distributed code.", "error");
        if (/core\/sh_config\.lua/.test(text)) add(line, "config-layout", "Read Config directly; do not add a sh_config normalization layer.");
    });
    if (side === "server" && /RegisterNetEvent|lib\.callback\.register/.test(code)) {
        add(1, "manual-server-review", "Inspect every public handler for source capture before yield, server-derived permissions/values, payload bounds, rate limits, concurrent mutations, distance/bucket checks where relevant, and identity revalidation after yield.");
    }
    return { findings, assurance: "Pattern-based triage only. Matches can include comments or strings. No findings does not prove security, correctness, or performance." };
}
