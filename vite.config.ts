import { defineConfig, loadEnv, type Plugin } from "vite";
import { judgeRequest } from "./src/judge-route.ts";

// Dev-only twin of api/judge.ts (the Vercel function): holds the Jev key, forwards the judge call.
function judgeRoute(apiKey: string): Plugin {
  return {
    name: "judge-route",
    configureServer(server) {
      if (!apiKey) throw new Error("JEV_API_KEY missing from .env");
      server.middlewares.use("/api/judge", async (req, res) => {
        let raw = "";
        // ponytail: reads the whole body before the size check; fine on localhost
        if (req.method === "POST") for await (const chunk of req) raw += chunk;
        const { status, body } = req.method === "POST" ? await judgeRequest(raw, apiKey) : { status: 405, body: { error: "POST only" } };
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
      });
    },
  };
}

export default defineConfig(({ mode }) => ({ plugins: [judgeRoute(loadEnv(mode, process.cwd(), "JEV_").JEV_API_KEY)] }));
