export function showProgress(): {
  update(phase: string, done: number, total: number): void;
  done(summary: string): void;
  remove(): void;
} {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;" +
    "display:flex;align-items:center;justify-content:center;padding:16px;";

  const box = document.createElement("div");
  box.style.cssText =
    "background:#fff;border-radius:10px;max-width:360px;width:100%;padding:18px;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:14px;color:#111;";

  const text = document.createElement("div");
  text.style.cssText = "font-size:16px;font-weight:bold;margin-bottom:12px;";

  const track = document.createElement("div");
  track.style.cssText = "height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;";

  const bar = document.createElement("div");
  bar.style.cssText =
    "height:100%;width:0%;background:#005dab;border-radius:999px;transition:width .2s ease;";

  track.appendChild(bar);
  box.appendChild(text);
  box.appendChild(track);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function update(phase: string, done: number, total: number): void {
    if (total <= 0) {
      text.textContent = `Processing ${phase.toLowerCase()}…`;
      bar.style.width = "35%";
      return;
    }

    const percent = Math.min(100, Math.round((done / total) * 100));
    text.textContent = `${phase} ${done}/${total}`;
    bar.style.width = `${percent}%`;
  }

  function remove(): void {
    overlay.remove();
  }

  return {
    update,
    done(summary: string): void {
      text.textContent = summary;
      track.remove();

      const button = document.createElement("button");
      button.textContent = "Close";
      button.style.cssText =
        "margin-top:14px;width:100%;padding:10px;background:#005dab;color:#fff;" +
        "border:none;border-radius:5px;font-size:14px;cursor:pointer;";
      button.addEventListener("click", remove);
      box.appendChild(button);
    },
    remove,
  };
}
