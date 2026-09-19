// PROTOTYPE — throwaway. Five typography variants of the real game, switchable via ?variant=A..E
// and a floating bottom bar. Dev only. Delete this file (and its import in main.ts) once a variant wins.
const VARIANTS = {
  A: "Alegreya — sturdy book serif",
  B: "Original — IM Fell English",
  C: "EB Garamond — elegant, larger",
  D: "Alegreya Sans — clean sans body",
  E: "Crimson Pro — big, no italics, brighter",
} as const;
type Key = keyof typeof VARIANTS;
const keys = Object.keys(VARIANTS) as Key[];

const face = (family: string, file: string) =>
  `@font-face { font-family: "${family}"; src: url("/fonts/${file}-400.woff2") format("woff2"); font-display: swap; }
   @font-face { font-family: "${family}"; font-style: italic; src: url("/fonts/${file}-400-italic.woff2") format("woff2"); font-display: swap; }`;

const css = `
${face("Alegreya Sans", "alegreya-sans")}
${face("Crimson Pro", "crimson-pro")}
[data-variant=B] { --body-font: "IM Fell English"; }
[data-variant=C] { --body-font: "EB Garamond"; font-size: 17px; }
[data-variant=C] body { font-size: 20px; }
[data-variant=D] { --body-font: "Alegreya Sans"; }
[data-variant=D] body { line-height: 1.4; }
[data-variant=D] .tile { letter-spacing: 0.02em; }
[data-variant=E] { --body-font: "Crimson Pro"; --dim: #bdb5cc; font-size: 18px; }
[data-variant=E] body { font-size: 20px; }
[data-variant=E] :is(.enemy-info p, .premise, .log > p, .log q, .log .divider) { font-style: normal; }
[data-variant=E] .scroll textarea::placeholder { font-style: normal; }

.proto-bar { position: fixed; z-index: 9999; left: 50%; bottom: 12px; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; padding: 4px; font: 14px/1 system-ui, sans-serif; color: #111; background: #fff; border-radius: 999px; box-shadow: 0 4px 20px #000a; }
.proto-bar button { min-height: 0; width: 32px; height: 32px; padding: 0; font: inherit; letter-spacing: 0; color: #fff; background: #111; border: 0; border-radius: 50%; }
.proto-bar span { padding: 0 8px; white-space: nowrap; }
`;

if ((import.meta as any).env.DEV) {
  document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
  const bar = document.createElement("div");
  bar.className = "proto-bar";
  bar.innerHTML = `<button aria-label="Previous variant">←</button><span></span><button aria-label="Next variant">→</button>`;
  document.body.append(bar);
  const label = bar.querySelector("span")!;

  const param = new URLSearchParams(location.search).get("variant")?.toUpperCase() as Key;
  let current: Key = keys.includes(param) ? param : "A";
  const show = (k: Key) => {
    current = k;
    document.documentElement.dataset.variant = k;
    label.textContent = `${k} — ${VARIANTS[k]}`;
    const url = new URL(location.href);
    url.searchParams.set("variant", k);
    history.replaceState(null, "", url);
  };
  const step = (d: number) => show(keys[(keys.indexOf(current) + d + keys.length) % keys.length]);
  const [prev, next] = bar.querySelectorAll("button");
  prev.onclick = () => step(-1);
  next.onclick = () => step(1);
  addEventListener("keydown", (e) => {
    if ((e.target as Element).closest?.("input, textarea, [contenteditable]")) return;
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  show(current);
}
