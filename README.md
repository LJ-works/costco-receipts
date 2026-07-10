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

## CI 与发布

GitHub Actions 会在 PR 及推送到 `main` 时运行 lint、类型检查、测试和构建。

项目使用 [Release Please](https://github.com/googleapis/release-please) 管理语义化版本和发布：

1. 对 `main` 的提交必须使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式，例如 `fix: 修复订单搜索`、`feat: 添加降价提醒`。
2. Release Please 会根据提交创建或更新 release PR，其中包含 `package.json`、`package-lock.json` 的版本更新和 `CHANGELOG.md`。
3. 合并该 release PR 后，Release Please 创建版本 tag 和 GitHub Release；CI 会以该 tag 构建 `dist/costco-userjs.user.js`，并作为 Release asset 上传。

版本对应关系：`fix:` 生成 patch 版本，`feat:` 生成 minor 版本，带 `!` 或 `BREAKING CHANGE:` 的提交生成 major 版本。不要手动运行 `npm version`；版本由 Release Please 在 release PR 中更新。
