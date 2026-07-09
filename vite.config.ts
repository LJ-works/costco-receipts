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
        // grant 由插件自动扫描推断，一般无需手写
      },
    }),
  ],
});
