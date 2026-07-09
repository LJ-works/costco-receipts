export default {
  "*.{ts,js,mts,cts,mjs,cjs}": ["oxlint --fix", "oxfmt --write"],
  // 函数形式：忽略传入的文件名，对整个项目跑 tsc（带文件名会绕过 tsconfig.json）
  "*.{ts,mts,cts}": () => "tsc --noEmit",
};
