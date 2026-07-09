# AGENTS.md

Costco 油猴脚本。TypeScript 编写，vite + vite-plugin-monkey 打包成单个 `.user.js`。

- 构建产物是 userscript，不是普通网页/库。userscript 头（`@match`/`@grant` 等）在 `vite.config.ts` 里配置。
- `import` 的 npm 包会被打包进最终的 `.user.js`。
- 脚本运行在 costco.com 的实时页面上，DOM 交互部分靠浏览器手动验证。

## 测试

- 写的代码要有配套测试（vitest）。
- 测试文件放在被测代码**同一文件夹**下，命名 `*.test.ts`。
- 把可测的纯逻辑（解析、计算、格式化）从 DOM 操作里抽出来，测这部分。
