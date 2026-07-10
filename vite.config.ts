import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

export default defineConfig({
  plugins: [
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: "costco-userjs",
        namespace: "https://github.com/costco-userjs",
        match: ["https://www.costco.com/*"],
        // The plugin infers grants automatically, so they usually do not need to be listed.
      },
    }),
  ],
});
