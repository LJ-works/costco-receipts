export default {
  "*.{ts,js,mts,cts,mjs,cjs}": ["oxlint --fix", "oxfmt --write"],
  // Ignore passed filenames and type-check the whole project; filenames would bypass tsconfig.json.
  "*.{ts,mts,cts}": () => "tsc --noEmit",
};
