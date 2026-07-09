import { describe, expect, it } from "vitest";

// 占位 sanity 测试，证明测试链路可用。
// 写功能时把纯逻辑抽成函数，测试就地放 *.test.ts 旁边。
describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
