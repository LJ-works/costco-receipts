# 参与开发

本项目使用 TypeScript 编写，并由 Vite 和 vite-plugin-monkey 打包成单个 `.user.js`。建议使用与 CI 一致的 Node.js 26。

## 本地开发

```bash
npm install
npm run dev
```

首次运行 `npm run dev` 时，按浏览器提示安装开发版 userscript；之后修改代码即可本地热更新。

脚本运行在 costco.com 的实时页面上。修改 DOM 交互后，请在桌面浏览器及需要支持的 iOS Userscripts 环境中手动验证。

## 构建

```bash
npm run build
```

构建产物为：

```text
dist/costco-userjs.user.js
```

userscript 头信息（例如 `@match`、`@grant`）在 `vite.config.ts` 中配置。导入的 npm 依赖会打包进最终的 `.user.js`。

## 测试与代码质量

```bash
npm run typecheck     # TypeScript 类型检查
npm run lint          # oxlint
npm run lint:fix      # 自动修复 lint 问题
npm test              # 运行全部 vitest 测试
npm run test:watch    # 监听模式运行测试
npm run format        # 使用 oxfmt 格式化
npm run format:check  # 检查格式
npm run build         # 验证生产构建
```

新增或修改可测试逻辑时，需要添加对应的 vitest 测试：

- 测试文件与被测文件放在同一目录。
- 测试文件命名为 `*.test.ts`。
- 尽量把解析、计算、筛选和格式化等纯逻辑从 DOM 编排中抽离并测试。
- IndexedDB、网络请求和 DOM 交互需要在浏览器中手动验证。

提交时，pre-commit hook 会对暂存的 JavaScript/TypeScript 文件运行 `oxlint --fix` 和 `oxfmt --write`，并执行 TypeScript 类型检查。

## CI

GitHub Actions 会在 pull request 及推送到 `main` 时依次运行：

1. lint
2. 类型检查
3. 测试
4. userscript 构建

## 提交与发布

所有提交信息必须使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式，例如：

```text
feat: add price matching
fix: handle missing product prices
docs: update iOS installation guide
```

项目使用 [Release Please](https://github.com/googleapis/release-please) 管理语义化版本和发布：

1. Conventional Commits 合并到 `main` 后，Release Please 创建或更新 release PR。
2. Release PR 更新 `package.json`、`package-lock.json` 和 `CHANGELOG.md`。
3. 合并 release PR 后，Release Please 创建版本 tag 和草稿 GitHub Release。
4. CI 使用该 tag 构建并上传 `dist/costco-userjs.user.js`，然后发布 GitHub Release；发布后 release 保持不可变。

`fix:` 通常生成 patch 版本，`feat:` 生成 minor 版本，带 `!` 或 `BREAKING CHANGE:` 的提交生成 major 版本。不要手动运行 `npm version`。
