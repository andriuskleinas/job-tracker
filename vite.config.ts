import { defineConfig, type PluginOption, type UserConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// Standard TanStack Start + Vite config, deploying to Vercel via Nitro.
// (Replaces the Lovable wrapper `@lovable.dev/vite-tanstack-config`, which
// targeted Cloudflare.) The plugin order matters: tanstackStart → nitro →
// viteReact, mirroring what the wrapper composed.
export default defineConfig(async ({ command }): Promise<UserConfig> => {
  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Route SSR through our custom error-wrapping server entry (src/server.ts).
      server: { entry: "server" },
    }),
  ];

  // Nitro builds the deployable server bundle. It's only needed for `vite build`
  // (dev is served by TanStack Start's own middleware). The "vercel" preset emits
  // a `.vercel/output` Build Output API directory that Vercel deploys directly.
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ preset: "vercel" }));
  }

  // React plugin must come after tanstackStart.
  plugins.push(viteReact());

  return {
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: { host: "::", port: 8080 },
    plugins,
  };
});
