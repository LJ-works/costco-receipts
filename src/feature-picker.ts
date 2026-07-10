export type FeatureKey = "find-order" | "pricing-match";

interface FeatureOption {
  key: FeatureKey;
  label: string;
}

const FEATURES: FeatureOption[] = [
  { key: "find-order", label: "查找订单" },
  { key: "pricing-match", label: "30 天价格匹配" },
];

export function showFeaturePicker(): Promise<FeatureKey> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;" +
      "display:flex;align-items:center;justify-content:center;padding:16px;";

    const box = document.createElement("div");
    box.style.cssText =
      "background:#fff;border-radius:10px;max-width:320px;width:100%;padding:18px;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.25);color:#111;";

    const title = document.createElement("div");
    title.textContent = "选择功能";
    title.style.cssText = "font-size:18px;font-weight:bold;margin-bottom:14px;";
    box.appendChild(title);

    for (const feature of FEATURES) {
      const button = document.createElement("button");
      button.textContent = feature.label;
      button.style.cssText =
        "display:block;width:100%;padding:12px;margin-top:10px;background:#005dab;color:#fff;" +
        "border:none;border-radius:6px;font-size:16px;cursor:pointer;text-align:center;";
      button.addEventListener("click", () => {
        overlay.remove();
        resolve(feature.key);
      });
      box.appendChild(button);
    }

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}
