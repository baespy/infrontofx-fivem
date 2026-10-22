import { fetchNativeIndex, findNatives } from "../src/natives.mjs";
const index = await fetchNativeIndex();
const result = findNatives(index, "GET_PLAYER_PED", "any", 2);
if (!result.results.some((entry) => entry.name === "GET_PLAYER_PED")) throw new Error("Official native lookup smoke test failed.");
console.log(JSON.stringify({ entries: index.length, ...result }, null, 2));
