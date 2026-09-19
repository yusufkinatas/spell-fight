// Vercel function: the production home of POST /api/judge. JEV_API_KEY is a Vercel environment variable.
import { judgeRequest } from "../src/judge-route.ts";

// ponytail: per-instance memory, so the limit is approximate across Vercel instances. Vercel Firewall rule or a KV counter if abused.
const LIMIT = 20; // casts per minute per IP
const hits = new Map<string, number[]>();

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "?";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= LIMIT) return Response.json({ error: "slow down" }, { status: 429 });
  hits.set(ip, [...recent, now]);
  if (hits.size > 5000) hits.clear();

  const { status, body } = await judgeRequest(await request.text(), process.env.JEV_API_KEY ?? "");
  return Response.json(body, { status });
}
