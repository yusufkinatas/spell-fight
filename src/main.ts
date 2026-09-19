import { BARRIER_BREAKS_LINE, ENEMIES, FORBIDDEN_LABELS, HOLLOW_HINT, LOSE_LINE, PREMISE_LINE, WIN_LINE, immuneHint, type Enemy } from "./content.ts";
import { TUNING, applyCast, canCast, drawHand, isPhaseChange, isWon, logFizzle, logNextEnemy, logTurn, newRun, nextEnemy, revealCues, usedHandWords, wordCount, type Cue, type LogEntry, type Run } from "./game.ts";
import { effect, music, playCue, setSetting, settings, shimmer, unlockAudio } from "./audio.ts";
import { icon } from "./icons.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;

let started = false; // the title screen shows until Begin; Restart and Play again never come back to it
let run = newRun();
let turn = 0;
let hand = drawHand();
let log: LogEntry[] = []; // the current Battle's Combat log
let runId = crypto.randomUUID(); // groups one Run's analytics events

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
  // The ghost chunk gets the same width and lags behind on a CSS delay.
  for (const bar of row.querySelectorAll<HTMLElement>(".hp-fill, .hp-ghost")) bar.style.width = `${(100 * hp) / max}%`;
  row.querySelector("span")!.textContent = `${hp}/${max}`;
}

function hpBar(label: string, hp: number, max: number): HTMLElement {
  const row = el("div", "hp", icon("glass-heart"), el("div", "hp-track", el("div", "hp-ghost"), el("div", "hp-fill")), el("span"));
  row.title = label;
  setHp(row, hp, max);
  return row;
}

// Reveal playback: each cue is a CSS animation (intensity in --i, 0..1) and a wait. It only plays cues; game.ts decided them.
const CUE_MS: Record<Cue["kind"], number> = { cast: 350, fizzle: 600, hit: 500, immune: 500, hollow: 600, "instant-kill": 700, "attack-lands": 350, shield: 300, hurt: 500, "barrier-shatter": 700, "enemy-death": 700, "player-death": 700 };
type RevealUi = { stage: HTMLElement; portrait: HTMLElement; enemyBar: HTMLElement; you: HTMLElement; resultBox: HTMLElement; banner: HTMLElement };

async function playReveal(cues: Cue[], ui: RevealUi, after: Run, enemyMaxHp: number) {
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
  // The verdict strip is already in the box: a beat reveals its next row.
  let beat = 0;
  ui.resultBox.classList.add("staged");
  const say = () => ui.resultBox.querySelectorAll(".vrow")[beat++]?.classList.add("in");
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
        say();
        break;
      case "hit":
        fx(ui.portrait, "hit", cue.intensity / 5);
        float(ui.portrait, cue.damage ? `−${cue.damage}` : "miss");
        setHp(ui.enemyBar, after.enemyHp, enemyMaxHp);
        say();
        break;
      case "immune":
        fx(ui.portrait, "immune");
        float(ui.portrait, "immune");
        say();
        break;
      case "hollow":
        ui.stage.append(el("i", "puff"));
        float(ui.portrait, "hollow");
        say();
        break;
      case "instant-kill":
        fx(ui.stage, "finisher");
        fx(ui.portrait, "hit");
        float(ui.portrait, "perfect");
        setHp(ui.enemyBar, 0, enemyMaxHp);
        say();
        say();
        break;
      case "attack-lands":
        fx(ui.banner, "lands");
        say();
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

// One Cast makes two facts — what your Spell did, what the Attack did — so it renders as two rows of five pips.
// Everything is read off the newest Combat log entry, so the stage and the log can never disagree.

type VerdictTurn = Extract<LogEntry, { kind: "turn" }>;

const verdictChip = (cls: string, text: string) => el("span", `chip ${cls}`, text);

// Icon, five pips, optional chip; a hint wraps under the pips. A negated Offence is struck through the pips the Judge did award.
function verdictRow(glyph: string, score: number, label: string, struck = false, tail?: HTMLElement, hint = "") {
  const shown = el("span", "pips", el("i", "on", "●".repeat(score)), el("i", "off", "○".repeat(5 - score)));
  shown.setAttribute("role", "img"); // otherwise a screen reader spells out five circles
  shown.setAttribute("aria-label", label);
  return el("div", struck ? "vrow struck" : "vrow", icon(glyph), shown, ...(tail ? [tail] : []), ...(hint ? [el("p", "hint", hint)] : []));
}

// The Offence chip and whether the row is struck: the same for the stage and the Combat log.
const negatedIn = (e: VerdictTurn) => e.immune || e.hollow;
const verdictOffence = (e: VerdictTurn) =>
  e.immune ? verdictChip("tag", "Immune") : e.hollow ? verdictChip("tag", "Hollow") : e.instantKill ? verdictChip("good", "Kill") : e.enemyHpLost ? verdictChip("hit", `−${e.enemyHpLost}`) : undefined;
const verdictDefence = (e: VerdictTurn, label: string) =>
  verdictRow("checked-shield", e.defence, label, false, e.playerHpLost ? verdictChip("hurt", `−${e.playerHpLost}`) : verdictChip("good", "Blocked"));

function verdictStrip(e: LogEntry | undefined, enemy: Enemy): HTMLElement {
  // Turn 0, a new Battle and the Phase divider all teach the mapping with two empty, labelled rows.
  if (!e || e.kind === "phase")
    return el("div", "strip legend", verdictRow("crossed-swords", 0, "Offence", false, el("small", "", "Offence")), verdictRow("checked-shield", 0, "Defence", false, el("small", "", "Defence")));
  if (e.kind === "fizzle") return el("div", "strip", el("div", "vrow flat", verdictChip("tag", "Fizzle"), el("small", "", e.forbidden)));
  const negated = negatedIn(e);
  const hint = e.hollow ? HOLLOW_HINT : e.immune && enemy.immunity ? immuneHint(enemy.immunity.to) : "";
  const sword = verdictRow("crossed-swords", negated ? e.judged : e.offence, `Offence ${e.offence} of 5`, negated, verdictOffence(e), hint);
  // An instant kill stops the Attack, so there is no Defence row to show.
  return el("div", e.instantKill ? "strip kill" : "strip", sword, ...(e.instantKill ? [] : [verdictDefence(e, `Defence ${e.defence} of 5`)]));
}

// The log becomes a history of strips: the Attack (a duplicate of the banner) and the reason (now on stage) drop out.
const verdictLogRow = (e: VerdictTurn) =>
  el(
    "li",
    "verdict",
    el("b", "", String(e.turn)),
    el("q", "", e.spell),
    el("div", "scores mini", verdictRow("crossed-swords", negatedIn(e) ? e.judged : e.offence, `Offence ${e.offence} of 5`, negatedIn(e), verdictOffence(e)), ...(e.instantKill ? [] : [verdictDefence(e, `Defence ${e.defence} of 5`)])),
  );

function renderLog(): HTMLElement {
  const entries = log.map((e) =>
    e.kind === "phase" ? el("li", "divider", "the barrier breaks") : e.kind === "fizzle" ? el("li", "fizzle", el("q", "", e.spell), el("small", "", `Fizzled: ${e.forbidden}`)) : verdictLogRow(e),
  );
  return el("aside", "log", el("h2", "", "Combat log"), entries.length ? el("ol", "", ...entries) : el("p", "", "No spells cast yet."));
}

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
  app.replaceChildren(el("div", "battle", stage, renderLog()));
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
      hand = drawHand();
      render();
    };
    stage.append(el("div", "result", verdictStrip(log[0], enemy)), el("div", "end", el("h2", "", run.playerHp === 0 ? LOSE_LINE : ended ? WIN_LINE : phaseChange ? BARRIER_BREAKS_LINE : `The ${enemy.name} falls.`), next), you);
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
      return;
    } finally {
      stopShimmer();
      stage.classList.remove("judging");
    }
    const before = run;
    const [castTurn, castHand] = [turn, hand]; // as the player saw them: a judged Cast advances both
    if (verdict.forbidden !== "none") {
      // Free retry: no HP change, same hand, same attack. The scores are ignored.
      const label = FORBIDDEN_LABELS[verdict.forbidden] ?? verdict.forbidden;
      log = logFizzle(log, input.value, label);
    } else {
      run = applyCast(run, enemy, verdict);
      log = logTurn(log, input.value, attack, enemy, verdict, before, run);
      turn++;
      hand = drawHand();
    }
    track("cast", { enemy: enemy.name, enemy_index: before.enemy, turn: castTurn, attack, hand: castHand, spell: input.value, ...verdict, enemy_hp_before: before.enemyHp, enemy_hp_after: run.enemyHp, player_hp_before: before.playerHp, player_hp_after: run.playerHp });
    if (run.playerHp === 0 || isWon(run)) track("run_ended", { outcome: run.playerHp === 0 ? "lost" : "won", enemy: enemy.name, enemy_index: run.enemy, player_hp: run.playerHp });
    // The strip is built before the Reveal so each row can land on its own beat.
    resultBox.replaceChildren(verdictStrip(log[0], enemy));
    await playReveal(revealCues(verdict, enemy, before, run), { stage, portrait, enemyBar, you, resultBox, banner }, run, enemy.hp);
    render(); // the end state, whether the Reveal played out or was skipped
    if (run.playerHp === 0) effect("lose");
    else if (isWon(run)) effect("win");
  };
  // The banner carries the enemy's own Portrait glyph, so the crossed swords mean only "your Offence".
  const banner = el("div", "attack", icon(enemy.portrait), el("div", "", el("small", "", "Incoming"), attack));
  const resultBox = el("div", "result", verdictStrip(log[0], enemy));
  stage.append(
    resultBox, // the Turn just played (the past) sits above the Incoming banner (the future)
    banner,
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

render();
