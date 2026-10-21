import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Local demo: run the real UI with in-memory mocks for Amplify auth and API.
// Usage: npx vite --config vite.demo.config.ts
// Then open http://localhost:5175/demo/
const demoDir = fileURLToPath(new URL("./demo", import.meta.url));

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Only scan the demo page. The production index.html imports the real
    // Amplify UI package, which is intentionally not part of the demo.
    entries: ["demo/index.html"],
  },
  resolve: {
    alias: [
      {
        find: /^aws-amplify\/api$/,
        replacement: path.join(demoDir, "mock-amplify-api.ts"),
      },
      {
        find: /^aws-amplify\/auth$/,
        replacement: path.join(demoDir, "mock-amplify-auth.ts"),
      },
    ],
  },
  server: {
    port: 5175,
    strictPort: true,
  },
});
