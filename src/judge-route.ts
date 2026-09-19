// Server-side only: the whole /api/judge route, shared by the Vite dev server and the Vercel function.
import { ENEMIES } from "./content.ts";
import { judge } from "./judge.ts";

// Raw POST body in, status + JSON out.
export async function judgeRequest(raw: string, apiKey: string): Promise<{ status: number; body: unknown }> {
  if (raw.length > 4000) return { status: 413, body: { error: "too large" } };
  try {
    const { enemy, attack, spell } = JSON.parse(raw);
    // Only our own enemies and attacks are judged, so the route can't be used as a general Jev proxy.
    // The immunity goes into a question's instructions, so it too comes from our content, never from the request.
    const known = ENEMIES.find((e) => e.name === enemy?.name && e.description === enemy?.description && e.attacks.includes(attack));
    if (!known || typeof spell !== "string" || !spell.trim()) return { status: 400, body: { error: "need a known enemy, one of its attacks, and a spell" } };
    return { status: 200, body: await judge({ enemy: { name: known.name, description: known.description }, attack, spell, immunity: known.immunity?.to }, apiKey) };
  } catch (e) {
    console.error(e);
    return { status: 500, body: { error: "judge failed" } };
  }
}
