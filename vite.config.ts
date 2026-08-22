// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";

function netlifyFunctionsDevPlugin(): Plugin {
  return {
    name: "netlify-functions-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url && url.startsWith("/.netlify/functions/")) {
          try {
            const env = loadEnv("development", process.cwd(), "");
            for (const [k, v] of Object.entries(env)) {
              process.env[k.replace(/^\uFEFF/, "")] = v;
            }
            const bodyText = await new Promise<string>((resolve, reject) => {
              if ((req as any).body) {
                return resolve(
                  typeof (req as any).body === "string"
                    ? (req as any).body
                    : JSON.stringify((req as any).body)
                );
              }
              const chunks: any[] = [];
              req.on("data", (chunk: any) => chunks.push(chunk));
              req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
              req.on("error", reject);
            });

            const protocol = req.headers["x-forwarded-proto"] || "http";
            const host = req.headers.host || "localhost:8080";
            const method = req.method || "GET";
            const isGetOrHead = ["GET", "HEAD"].includes(method);
            const request = new Request(
              `${protocol}://${host}${req.url}`,
              isGetOrHead
                ? { method, headers: req.headers as HeadersInit }
                : { method, headers: req.headers as HeadersInit, body: bodyText }
            );

            const fnName = url.replace("/.netlify/functions/", "");
            const functionFile = `./netlify/functions/${fnName}.ts`;
            const mod = await server.ssrLoadModule(functionFile);
            const handler = mod["default"];

            const response: Response = await handler(request);

            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });

            const resBody = await response.text();
            res.end(resBody);
          } catch (err: any) {
            console.error("Local Netlify function error:", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err?.message || "Internal server error" }));
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [netlifyFunctionsDevPlugin()],
  },
});
