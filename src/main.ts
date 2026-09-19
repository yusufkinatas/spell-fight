import { BARRIER_BREAKS_LINE, BARRIER_BREAKS_LINE_SHORT, DEFENCE_LINES, ENEMIES, FIZZLE_LINE, FORBIDDEN_LABELS, HOLLOW_LINE, HOLLOW_REASON, HOLLOW_REASON_SHORT, INSTANT_KILL_LINE, INSTANT_KILL_LINE_SHORT, KILL_LINE, LOSE_LINE, LOSE_LINE_SHORT, OFFENCE_LINES, PREMISE_LINE, WIN_LINE, fizzleReasonShort, immuneReason, immuneReasonShort } from "./content.ts";
import { TUNING, applyCast, canCast, drawHand, isPhaseChange, isWon, logFizzle, logNextEnemy, logTurn, newRun, nextEnemy, offenceOf, revealCues, usedHandWords, wordCount, type Cue, type LogEntry, type Run } from "./game.ts";
import { effect, music, playCue, setSetting, settings, shimmer, unlockAudio } from "./audio.ts";
import { icon } from "./icons.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;

let started = false; // the title screen shows until Begin; Restart and Play again never come back to it
let run = newRun();
let turn = 0;
let hand = drawHand();
let result = "";
let log: LogEntry[] = []; // the current Battle's Combat log
let runId = crypto.randomUUID(); // groups one Run's analytics events

// Prototype switcher: ←/→ swap battle-screen variants live, so they can be compared mid-Battle.
// ponytail: throwaway scaffolding. Pick a winner, then delete the switcher and the losing variants.
const VARIANTS = ["current", "subtract", "disclose", "show", "moment"] as const;
type Variant = (typeof VARIANTS)[number];
let variant: Variant = VARIANTS.find((v) => v === localStorage.getItem("variant")) ?? "current";
let busy = false; // a Cast is being judged or revealed: switching would re-render under it

// Analytics: PostHog comes from the snippet in index.html, and is absent in local dev.
// ponytail: client-side capture, so ad blockers lose those players. Proxy PostHog through a Vercel rewrite if the gap matters.
const track = (event: string, props: object = {}) => (window as { posthog?: { capture(event: string, props: object): void } }).posthog?.capture(event, { run_id: runId, ...props });

// `el("p", "cls", ...children)`: strings become text nodes.
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}

function setHp(row: HTMLElement, hp: number, max: number) {
  row.querySelector<HTMLElement>(".hp-fill")!.style.width = `${(100 * hp) / max}%`;
  row.querySelector("span")!.textContent = `${hp}/${max}`;
}

function hpBar(label: string, hp: number, max: number): HTMLElement {
  const row = el("div", "hp", icon("glass-heart"), el("div", "hp-track", el("div", "hp-fill")), el("span"));
  row.title = label;
  setHp(row, hp, max);
  return row;
}

// Reveal playback: each cue is a CSS animation (intensity in --i, 0..1) and a wait. It only plays cues; game.ts decided them.
const CUE_MS: Record<Cue["kind"], number> = { cast: 350, fizzle: 600, hit: 500, immune: 500, hollow: 600, "instant-kill": 700, "attack-lands": 350, shield: 300, hurt: 500, "barrier-shatter": 700, "enemy-death": 700, "player-death": 700 };
type RevealUi = { stage: HTMLElement; portrait: HTMLElement; enemyBar: HTMLElement; you: HTMLElement; resultBox: HTMLElement; banner: HTMLElement };

async function playReveal(cues: Cue[], ui: RevealUi, lines: string[], after: Run, enemyMaxHp: number) {
  let skipped = false;
  let wake = () => {};
  // Any key, click or tap skips to the end state.
  const skip = () => {
    skipped = true;
    wake();
  };
  addEventListener("keydown", skip);
  addEventListener("pointerdown", skip);
  const fx = (target: HTMLElement, name: string, intensity = 1) => {
    target.style.setProperty("--i", String(Math.min(1, intensity)));
    target.classList.add(name);
  };
  const float = (target: HTMLElement, text: string) => target.append(el("b", "float", text));
  ui.resultBox.textContent = "";
  // subtract: the slot holds the Turn row instead, and the Reveal already shows what these lines would say.
  const say = (line: string) => { if (variant !== "subtract") ui.resultBox.append(line + "\n"); };
  for (const cue of cues) {
    if (skipped) break;
    playCue(cue);
    switch (cue.kind) {
      case "cast": {
        // The Spell flies from the scroll up to the Portrait.
        const from = ui.stage.getBoundingClientRect();
        const to = ui.portrait.getBoundingClientRect();
        const bolt = el("i", "bolt");
        bolt.style.setProperty("--x", `${to.left + to.width / 2 - from.left}px`);
        bolt.style.setProperty("--y", `${to.top + to.height / 2 - from.top}px`);
        ui.stage.append(bolt);
        break;
      }
      case "fizzle":
        ui.stage.append(el("i", "puff"));
        say(lines[0]);
        break;
      case "hit":
        fx(ui.portrait, "hit", cue.intensity / 5);
        float(ui.portrait, cue.damage ? `−${cue.damage}` : "miss");
        setHp(ui.enemyBar, after.enemyHp, enemyMaxHp);
        say(lines[0]);
        break;
      case "immune":
        fx(ui.portrait, "immune");
        float(ui.portrait, "immune");
        say(lines[0]);
        break;
      case "hollow":
        ui.stage.append(el("i", "puff"));
        float(ui.portrait, "hollow");
        say(lines[0]);
        break;
      case "instant-kill":
        fx(ui.stage, "finisher");
        fx(ui.portrait, "hit");
        float(ui.portrait, "perfect");
        setHp(ui.enemyBar, 0, enemyMaxHp);
        say(lines[0]);
        say(lines[1]);
        break;
      case "attack-lands":
        fx(ui.banner, "lands");
        say(lines[1]);
        break;
      case "shield":
        fx(ui.you, "shield");
        break;
      case "hurt":
        fx(ui.stage, "hurt", cue.intensity / 6);
        float(ui.you, `−${cue.intensity}`);
        setHp(ui.you, after.playerHp, TUNING.playerHp);
        break;
      case "barrier-shatter":
        ui.portrait.classList.replace("barrier", "shatter");
        break;
      case "enemy-death":
        ui.portrait.classList.remove("hit");
        fx(ui.portrait, "dying");
        break;
      case "player-death":
        fx(ui.stage, "falling");
        break;
    }
    await new Promise<void>((resolve) => {
      wake = resolve;
      setTimeout(resolve, CUE_MS[cue.kind]);
    });
  }
  removeEventListener("keydown", skip);
  removeEventListener("pointerdown", skip);
}

function link(href: string, text: string): HTMLAnchorElement {
  const a = el("a", "", text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

function renderTitle() {
  const begin = el("button", "begin", "Begin");
  // A real button press: later the same gesture unlocks audio.
  begin.onclick = () => {
    unlockAudio();
    started = true;
    track("run_started");
    render();
  };
  app.replaceChildren(
    el(
      "div",
      "title",
      el("div", "portrait", icon("dragon-head")),
      el("h1", "", "Spell Fight"),
      el("p", "premise", PREMISE_LINE),
      begin,
      el(
        "p",
        "credits",
        "Icons by Lorc, Delapouite and Cathelineau (",
        link("https://game-icons.net", "game-icons.net"),
        ", ",
        link("https://creativecommons.org/licenses/by/3.0/", "CC BY 3.0"),
        "). Music by Kevin MacLeod (",
        link("https://incompetech.com", "incompetech.com"),
        ", ",
        link("https://creativecommons.org/licenses/by/4.0/", "CC BY 4.0 — creativecommons.org/licenses/by/4.0"),
        ") and Juhani Junkala (CC0). Spells and visits are logged anonymously to improve the game.",
      ),
    ),
  );
  begin.focus();
}

const pips = (score: number) => "●".repeat(score) + "○".repeat(5 - score);

function renderLog(): HTMLElement {
  if (variant === "subtract") return el("aside", "log", el("h2", "", "Combat log"), el("ol", "", ...olderEntries().map(turnRow)));
  const entries = log.map((e) =>
    e.kind === "phase"
      ? el("li", "divider", "the barrier breaks")
      : e.kind === "fizzle"
        ? el("li", "fizzle", el("q", "", e.spell), el("small", "", `Fizzled: ${e.forbidden}`))
        : el(
            "li",
            "",
            el("b", "", `Turn ${e.turn}`),
            el("q", "", e.spell),
            el("small", "", e.attack),
            el("div", "scores", el("span", "", `Offence ${pips(e.offence)}`), el("span", "", e.immune ? "immune" : e.hollow ? "hollow" : e.instantKill ? "instant kill" : `−${e.enemyHpLost} enemy HP`)),
            ...(e.reason ? [el("small", "", e.reason)] : []),
            el("div", "scores", el("span", "", `Defence ${e.instantKill ? "—" : pips(e.defence)}`), el("span", "", `−${e.playerHpLost} HP`)),
          ),
  );
  return el("aside", "log", el("h2", "", "Combat log"), entries.length ? el("ol", "", ...entries) : el("p", "", "No spells cast yet."));
}

// --- variant: subtract ---
// One Turn is stated once, as one row: the newest on the stage in the slot the result block used (past above the
// Incoming banner), the older ones in the Combat log, same markup. What the Reveal already shows — hit weight, Hollow,
// Immune, both HP deltas — is not narrated again; only the lesson and the end heading stay as prose.

// A Phase divider is not a Turn, so it stays in the log and the stage slot is empty until the new Phase is Cast at.
const stageEntry = () => (log[0]?.kind === "phase" ? undefined : log[0]);
const olderEntries = () => (stageEntry() ? log.slice(1) : log);

function turnRow(e: LogEntry): HTMLElement {
  if (e.kind === "phase") return el("li", "divider", "the barrier breaks");
  if (e.kind === "fizzle") return el("li", "fizzle", el("q", "", e.spell), el("small", "", fizzleReasonShort(e.forbidden)));
  // The stored reason is the long result copy; the row wants the short one. A Battle's log is all one enemy, so the Immunity is this one's.
  const immunity = ENEMIES[run.enemy].immunity;
  const reason = e.immune && immunity ? immuneReasonShort(immunity.to) : e.hollow ? HOLLOW_REASON_SHORT : "";
  return el(
    "li",
    "",
    el("q", "", e.spell),
    el("div", "scores", el("span", "", `Offence ${pips(e.offence)}`), el("span", "", e.instantKill ? "enemy destroyed" : e.enemyHpLost ? `−${e.enemyHpLost} enemy HP` : "")),
    // Only an instant kill stops the Attack, so only then is there no Defence to show; the end heading says why.
    ...(e.instantKill ? [] : [el("div", "scores", el("span", "", `Defence ${pips(e.defence)}`), el("span", "", e.playerHpLost ? `−${e.playerHpLost} HP` : ""))]),
    ...(reason ? [el("small", "", reason)] : []),
  );
}

const turnSlot = () => {
  const e = stageEntry();
  return el("div", "log turn", ...(e ? [el("ol", "", turnRow(e))] : []));
};

// The end heading, rebuilt from state like everything else render() draws.
const subEndLine = () => {
  const last = stageEntry();
  if (run.playerHp === 0) return LOSE_LINE_SHORT;
  if (isWon(run)) return WIN_LINE;
  if (isPhaseChange(run)) return BARRIER_BREAKS_LINE_SHORT;
  // The row drops its Defence line on an instant kill, so the heading is where "no Attack landed" is said.
  if (last?.kind === "turn" && last.instantKill) return INSTANT_KILL_LINE_SHORT;
  return `The ${ENEMIES[run.enemy].name} falls.`;
};

function render() {
  if (!started) return renderTitle();
  const enemy = ENEMIES[run.enemy];
  music(enemy.music);
  const phaseChange = isPhaseChange(run);
  // The Barrier ring is up only while Phase 1 lives; a fallen enemy stays faded on the end screen.
  const portrait = el("div", run.enemyHp === 0 ? "portrait dead" : phaseChange ? "portrait barrier" : "portrait", icon(enemy.portrait));
  const enemyBar = hpBar("Enemy HP", run.enemyHp, enemy.hp);
  const stage = el(
    "div",
    run.playerHp === 0 ? "stage fallen" : "stage",
    el(
      "div",
      "enemy",
      portrait,
      el(
        "div",
        "enemy-info",
        el("h1", "", enemy.name),
        el("p", "", enemy.description),
        ...(enemy.immunity ? [el("div", "badge", icon("checked-shield"), ` Immune to ${enemy.immunity.to}`)] : []),
        enemyBar,
      ),
    ),
  );
  const you = hpBar("Your HP", run.playerHp, TUNING.playerHp);
  app.replaceChildren(el("div", "battle", stage, ...(variant === "subtract" && !olderEntries().length ? [] : [renderLog()])));
  if (run.enemyHp === 0 || run.playerHp === 0) {
    const ended = run.playerHp === 0 || isWon(run);
    const next = el("button", "", run.playerHp === 0 ? "Restart" : ended ? "Play again" : phaseChange ? "Fight on" : "Next enemy");
    next.onclick = () => {
      log = ended ? [] : logNextEnemy(log, run);
      run = ended ? newRun() : nextEnemy(run);
      if (ended) {
        runId = crypto.randomUUID();
        track("run_started");
      }
      turn = 0;
      result = "";
      hand = drawHand();
      render();
    };
    stage.append(variant === "subtract" ? turnSlot() : el("div", "result", result), el("div", "end", el("h2", "", variant === "subtract" ? subEndLine() : run.playerHp === 0 ? LOSE_LINE : ended ? WIN_LINE : phaseChange ? BARRIER_BREAKS_LINE : `The ${enemy.name} falls.`), next), you);
    next.focus();
    return;
  }

  const attack = enemy.attacks[turn % enemy.attacks.length];
  const tiles = hand.map((word) => el("span", "tile", word));
  const input = el("textarea");
  input.rows = 2;
  input.placeholder = "Write your spell…";
  const usedCount = el("span");
  const total = el("span");
  const cast = el("button", "", "Cast");
  const update = () => {
    const used = usedHandWords(input.value, hand);
    tiles.forEach((tile, i) => {
      if (used.includes(hand[i]) && !tile.classList.contains("used")) effect("chime");
      tile.classList.toggle("used", used.includes(hand[i]));
    });
    usedCount.textContent = `${used.length}/${TUNING.minHandWords} Hand words`;
    usedCount.className = used.length >= TUNING.minHandWords ? "ok" : "";
    total.textContent = `${wordCount(input.value)}/${TUNING.maxSpellWords} words`;
    total.className = wordCount(input.value) > TUNING.maxSpellWords ? "over" : "";
    cast.disabled = !canCast(input.value, hand);
  };
  input.oninput = update;
  update();
  cast.onclick = async () => {
    busy = true;
    cast.disabled = input.disabled = true;
    cast.textContent = "Judging…";
    stage.classList.add("judging");
    const stopShimmer = shimmer();
    let verdict: { forbidden: string; offence: number; defence: number; immune: boolean; hollow: boolean };
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enemy: { name: enemy.name, description: enemy.description }, attack, spell: input.value }),
      });
      if (!res.ok) throw new Error(`judge ${res.status}`);
      verdict = await res.json();
    } catch (e) {
      console.error(e);
      track("judge_failed", { enemy: enemy.name, error: String(e) });
      // Same hand, same attack: the player can simply cast again.
      cast.textContent = "The judge is silent. Cast again";
      cast.disabled = input.disabled = false;
      busy = false;
      return;
    } finally {
      stopShimmer();
      stage.classList.remove("judging");
    }
    const before = run;
    const [castTurn, castHand] = [turn, hand]; // as the player saw them: a judged Cast advances both
    let lines: string[];
    if (verdict.forbidden !== "none") {
      // Free retry: no HP change, same hand, same attack. The scores are ignored.
      const label = FORBIDDEN_LABELS[verdict.forbidden] ?? verdict.forbidden;
      lines = [`${FIZZLE_LINE} (${label})`];
      log = logFizzle(log, input.value, label);
    } else {
      run = applyCast(run, enemy, verdict);
      const offence = offenceOf(verdict);
      const instant = enemy.instantKill && offence === 5;
      const reason = verdict.immune && enemy.immunity ? immuneReason(enemy.immunity.to) : verdict.hollow ? HOLLOW_REASON : "";
      log = logTurn(log, input.value, attack, enemy, verdict, before, run, reason);
      lines = [
        `${(verdict.immune && enemy.immunity?.line) || (verdict.hollow && HOLLOW_LINE) || (instant ? INSTANT_KILL_LINE : OFFENCE_LINES[offence])} (−${before.enemyHp - run.enemyHp} enemy HP)`,
        // Only an instant kill stops the attack, so only then is there no defence line to show.
        `${instant ? KILL_LINE : DEFENCE_LINES[verdict.defence]} (−${before.playerHp - run.playerHp} HP)`,
        `Offence ${offence}/5${offence < verdict.offence ? ` (the Judge scored it ${verdict.offence}/5)` : ""} · Defence ${verdict.defence}/5`,
        ...(reason ? [reason] : []),
      ];
      turn++;
      hand = drawHand();
    }
    track("cast", { enemy: enemy.name, enemy_index: before.enemy, turn: castTurn, attack, hand: castHand, spell: input.value, ...verdict, enemy_hp_before: before.enemyHp, enemy_hp_after: run.enemyHp, player_hp_before: before.playerHp, player_hp_after: run.playerHp });
    if (run.playerHp === 0 || isWon(run)) track("run_ended", { outcome: run.playerHp === 0 ? "lost" : "won", enemy: enemy.name, enemy_index: run.enemy, player_hp: run.playerHp });
    result = lines.join("\n");
    await playReveal(revealCues(verdict, enemy, before, run), { stage, portrait, enemyBar, you, resultBox, banner }, lines, run, enemy.hp);
    busy = false;
    render(); // the end state, whether the Reveal played out or was skipped
    if (run.playerHp === 0) effect("lose");
    else if (isWon(run)) effect("win");
  };
  const banner = el("div", "attack", icon("crossed-swords"), el("div", "", el("small", "", "Incoming"), attack));
  const resultBox = variant === "subtract" ? turnSlot() : el("div", "result", result);
  stage.append(
    ...(variant === "subtract" ? [resultBox, banner] : [banner, resultBox]), // subtract: the Turn just played sits above the Incoming banner, past above future
    el("div", "hand", ...tiles),
    el("div", "casting", el("div", "scroll", input, el("div", "limits", usedCount, total)), el("div", "cast-row", you, cast)),
  );
  input.focus();
}

// Audio toggles live in a corner outside #app, so a render never touches them.
function toggle(key: keyof typeof settings, glyph: string, label: string): HTMLButtonElement {
  const button = el("button", "", icon(glyph));
  const show = () => {
    button.classList.toggle("off", !settings[key]);
    button.title = `${label}: ${settings[key] ? "on" : "off"}`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(settings[key]));
  };
  button.onclick = () => {
    setSetting(key, !settings[key]);
    show();
  };
  button.addEventListener("refresh", show);
  show();
  return button;
}
const toggles = el("div", "toggles", toggle("music", "double-quaver", "Music"), toggle("effects", "speaker", "Sound effects"));
document.body.append(toggles);

addEventListener("click", (e) => {
  if ((e.target as Element).closest("button")) effect("click");
});
// Title music starts on the first interaction the browser counts as a gesture. Pressing Begin goes straight to the
// fight track instead, so a phone never downloads a title track it will not hear.
function firstGesture(e: Event) {
  if ((e.target as Element).closest?.(".begin")) return;
  removeEventListener("pointerdown", firstGesture);
  removeEventListener("keydown", firstGesture);
  if (started) return;
  unlockAudio();
  music("title");
}
addEventListener("pointerdown", firstGesture);
addEventListener("keydown", firstGesture);

// M mutes or unmutes everything, except in the Spell input where it types a letter.
addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "m" || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
  const on = !(settings.effects || settings.music);
  setSetting("effects", on);
  setSetting("music", on);
  for (const button of toggles.children) button.dispatchEvent(new Event("refresh"));
});

// ←/→ cycle the variants, except while a Spell is half-written (the arrows move the caret there) or a Cast is playing.
const variantChip = el("div", "variant-chip");
function setVariant(next: Variant) {
  variant = next;
  localStorage.setItem("variant", variant);
  document.body.dataset.variant = variant;
  variantChip.textContent = `‹ ${VARIANTS.indexOf(variant) + 1}/${VARIANTS.length} ${variant} ›`;
}
addEventListener("keydown", (e) => {
  const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  if (!step || busy || !started || (e.target instanceof HTMLTextAreaElement && e.target.value)) return;
  e.preventDefault();
  setVariant(VARIANTS[(VARIANTS.indexOf(variant) + step + VARIANTS.length) % VARIANTS.length]);
  render();
});
document.body.append(variantChip);
setVariant(variant);

render();
