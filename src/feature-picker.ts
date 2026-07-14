export type FeatureKey = "find-order" | "price-adjustment" | "pricing-warning";

interface FeatureOption {
  key: FeatureKey;
  label: string;
}

const FEATURES: FeatureOption[] = [
  { key: "find-order", label: "Find Orders" },
  { key: "price-adjustment", label: "30-Day Price Adjustment" },
  { key: "pricing-warning", label: "Price Watch" },
];

export function showFeaturePicker(
  badges: Partial<Record<FeatureKey, number>> = {},
): Promise<FeatureKey> {
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
    title.textContent = "Choose a Feature";
    title.style.cssText = "font-size:18px;font-weight:bold;margin-bottom:14px;";
    box.appendChild(title);

    for (const feature of FEATURES) {
      const button = document.createElement("button");
      button.textContent = feature.label;
      button.style.cssText =
        "display:block;width:100%;padding:12px;margin-top:10px;background:#005dab;color:#fff;" +
        "border:none;border-radius:6px;font-size:16px;cursor:pointer;text-align:center;";

      const count = badges[feature.key] ?? 0;
      if (count > 0) {
        const badge = document.createElement("span");
        badge.textContent = String(count);
        badge.style.cssText =
          "display:inline-flex;align-items:center;justify-content:center;" +
          "min-width:20px;height:20px;box-sizing:border-box;padding:0 6px;" +
          "background:#dc2626;color:#fff;border-radius:999px;margin-left:8px;" +
          "font-size:12px;line-height:1;";
        button.appendChild(badge);
      }

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
