import { defineConfig, loadEnv, type Plugin } from "vite";
import { judge } from "./src/judge.ts";

// The one tiny server route: holds the Jev key, forwards the judge call.
function judgeRoute(apiKey: string): Plugin {
  return {
    name: "judge-route",
    configureServer(server) {
      server.middlewares.use("/api/judge", async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        if (req.method !== "POST") return send(405, { error: "POST only" });
        try {
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 4000) return send(413, { error: "too large" });
          }
          const { enemy, attack, spell } = JSON.parse(raw);
          const texts = [enemy?.name, enemy?.description, attack, spell];
          if (!texts.every((t) => typeof t === "string" && t.trim())) {
            return send(400, { error: "need enemy.name, enemy.description, attack, spell" });
          }
          // Rebuild the object so nothing but these four strings reaches `state`.
          send(200, await judge({ enemy: { name: enemy.name, description: enemy.description }, attack, spell }, apiKey));
        } catch (e) {
          console.error(e);
          send(500, { error: "judge failed" });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const apiKey = loadEnv(mode, process.cwd(), "JEV_").JEV_API_KEY;
  if (!apiKey) throw new Error("JEV_API_KEY missing from .env");
  return { plugins: [judgeRoute(apiKey)] };
});
