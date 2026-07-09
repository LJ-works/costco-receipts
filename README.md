# costco-userjs

Costco 油猴脚本，TypeScript 编写，vite + vite-plugin-monkey 打包成 `.user.js`。

## 开发

```bash
npm install        # 首次，自动装好 git hook
npm run dev        # 本地热更，浏览器按提示装一次脚本后改代码即时生效
```

## 构建

```bash
npm run build      # 产出 dist/costco-userjs.user.js
```

把 `dist/costco-userjs.user.js` 拖进 Tampermonkey 即可安装。

## 质量

- `npm run typecheck` —— tsc 类型检查
- `npm run lint` / `lint:fix` —— oxlint
- `npm run format` / `format:check` —— oxfmt

提交时 pre-commit hook 自动对暂存文件跑 `oxlint --fix` + `oxfmt --write`。

匹配站点、userscript 头（`@match`/`@grant` 等）在 `vite.config.ts` 里改。
