import { BARRIER_BREAKS_LINE, BARRIER_BREAKS_LINE_SHORT, DEFENCE_LINES, DISCLOSE_FIRST_HINT, DISCLOSE_FIZZLE_AGAIN, ENEMIES, FIZZLE_LINE, FORBIDDEN_LABELS, HOLLOW_LINE, HOLLOW_REASON, HOLLOW_REASON_SHORT, INSTANT_KILL_LINE, INSTANT_KILL_LINE_SHORT, KILL_LINE, LOSE_LINE, LOSE_LINE_SHORT, MOMENT_FIZZLE_HINT, MOMENT_HOLLOW_HINT, MOMENT_OFFENCE_TITLES, OFFENCE_LINES, PREMISE_LINE, WIN_LINE, fizzleReasonShort, immuneReason, immuneReasonShort, momentImmuneHint, type Enemy } from "./content.ts";
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
  const say = (line: string) => { if (variant !== "subtract") ui.resultBox.append(variant === "disclose" ? el("span", "said", line) : line + "\n"); };
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
  if (variant === "disclose") return discloseLog();
  const entries = isMoment() ? log.map(momentRow) : log.map((e) =>
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
  return el("aside", "log", el("h2", "", "Combat log"), entries.length ? el("ol", "", ...entries) : el("p", "", isMoment() ? "Nothing cast yet." : "No spells cast yet."));
}

// --- variant: moment ---
// The outcome of a Cast is a beat, not a panel: a card over the stage that says its piece once and retires into the
// Combat log. The resting screen then holds only the present decision (enemy, Incoming, Hand, Spell).
const isMoment = () => variant === "moment";
let moment: LogEntry | null = null; // the outcome not yet dismissed; render() rebuilds its card from this
let dropMoment: (() => void) | null = null; // drops the open card's global listeners, so none outlives its DOM

// A lesson needs longer than the mash that skipped the Reveal.
const momentGrace = (e: LogEntry) => (e.kind === "fizzle" || (e.kind === "turn" && (e.hollow || e.immune)) ? 900 : 400);

// One Cast's outcome: verdict, one flavour line, the two scores, at most one lesson. Everything comes from the LogEntry.
function momentCard(e: LogEntry, ...extra: Node[]): HTMLElement {
  const card = el("div", "moment");
  card.tabIndex = -1;
  card.setAttribute("role", "status");
  card.style.setProperty("--grace", `${momentGrace(e)}ms`); // the dismiss line fades in exactly as the card arms
  if (e.kind === "fizzle") {
    card.append(el("h2", "", "Fizzled"), el("p", "flavour", `${FIZZLE_LINE} (${e.forbidden})`), el("p", "hint", MOMENT_FIZZLE_HINT), ...extra);
  } else if (e.kind === "turn") {
    const immunity = ENEMIES[run.enemy].immunity;
    const hint = e.immune && immunity ? momentImmuneHint(immunity.to) : e.hollow ? MOMENT_HOLLOW_HINT : "";
    const row = (label: string, score: number, tag: string) => el("div", "score", el("span", "label", label), el("span", "pips", pips(score)), el("span", "tag", tag));
    card.append(
      el("h2", "", e.immune ? "Immune" : e.hollow ? "Hollow" : e.instantKill ? "Perfect" : MOMENT_OFFENCE_TITLES[e.offence]),
      // An instant kill stops the Attack, so it has no defence to report.
      ...(e.instantKill ? [] : [el("p", "flavour", DEFENCE_LINES[e.defence])]),
      row("Offence", e.offence, e.immune ? "immune" : e.hollow ? "negated" : e.instantKill ? "instant kill" : e.enemyHpLost ? `−${e.enemyHpLost} enemy HP` : "no harm"),
      ...(e.instantKill ? [] : [row("Defence", e.defence, e.playerHpLost ? `−${e.playerHpLost} HP` : "unhurt")]),
      ...(hint ? [el("p", "hint", hint)] : []),
      ...extra,
    );
  }
  if (!extra.length) card.append(el("div", "dismiss", "Tap or press any key"));
  return card;
}

// Show that card over the stage. With `extra` (an end line and its button) it is modal: only that button leaves it,
// so the keypress that skipped a Reveal can never advance the Run.
function openMoment(e: LogEntry, stage: HTMLElement, ...extra: Node[]) {
  dropMoment?.(); // one card at a time, and no listener left over from the last one
  stage.querySelector(".moment")?.remove();
  const card = momentCard(e, ...extra);
  stage.append(card);
  card.focus(); // while it is up the card owns the keyboard: no stray letters, no soft keyboard over the lesson
  if (extra.length) return;
  const armed = Date.now() + momentGrace(e);
  const onKey = (ev: KeyboardEvent) => {
    // Any key retires the card — but not a held one, not a modifier or a browser shortcut, and not ←/→, which belong
    // to the prototype switcher: flipping between variants must not eat the moment.
    if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey || /^(Arrow|Shift|Control|Alt|Meta|CapsLock|F\d)/.test(ev.key)) return;
    ev.preventDefault(); // the Spell takes focus next, and the dismissing keystroke must not land in it
    close();
  };
  const detach = () => {
    removeEventListener("keydown", onKey);
    removeEventListener("pointerdown", close);
    dropMoment = null;
  };
  const close = () => {
    if (Date.now() < armed) return; // the keypress that skipped the Reveal must not eat the moment either
    detach();
    moment = null;
    card.classList.add("retire");
    setTimeout(() => card.remove(), 220);
    document.querySelectorAll(".log li")[log.indexOf(e)]?.classList.add("fresh"); // it retires into its own row
    app.querySelector("textarea")?.focus();
  };
  dropMoment = detach;
  addEventListener("keydown", onKey);
  addEventListener("pointerdown", close);
}

// The log reads as history: two dim lines per Turn, no Attack sentence (only the Incoming banner has one), and the
// whole row is a button that re-opens that Turn's card. That is why the row need not repeat the lesson.
function momentRow(e: LogEntry): HTMLElement {
  if (e.kind === "phase") return el("li", "divider", "the barrier breaks");
  const meta =
    e.kind === "fizzle"
      ? el("div", "meta", el("b", "", "Fizzled"), el("span", "tag", e.forbidden))
      : el(
          "div",
          "meta",
          el("b", "", `Turn ${e.turn}`),
          el("span", "tag", e.immune ? "immune" : e.hollow ? "hollow" : e.instantKill ? "instant kill" : MOMENT_OFFENCE_TITLES[e.offence].toLowerCase()),
          el("span", "", [e.playerHpLost && `you −${e.playerHpLost}`, e.enemyHpLost && `enemy −${e.enemyHpLost}`].filter(Boolean).join(" · ") || "no damage"),
        );
  const replay = el("button", "", meta, el("q", "", e.spell));
  replay.title = "Show this turn again";
  replay.onclick = () => openMoment(e, document.querySelector<HTMLElement>(".stage")!);
  return el("li", "", replay);
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
// --- variant: disclose ---
type DiscloseTurn = Extract<LogEntry, { kind: "turn" }>;

// The two values the verdict strip and the log rows both show: what the Spell did, what the Attack cost.
const discloseValues = (e: DiscloseTurn): [string, string] => [
  e.instantKill ? "destroyed" : e.immune ? "immune" : e.hollow ? "hollow" : e.enemyHpLost ? `−${e.enemyHpLost} enemy HP` : "no damage",
  e.instantKill ? "no attack" : e.playerHpLost ? `−${e.playerHpLost} HP` : "blocked",
];

// What the Reveal says beat by beat: the same values the strip settles on, or the Fizzle's one line.
const discloseSaid = (e: LogEntry): string[] => (e.kind === "turn" ? discloseValues(e) : e.kind === "fizzle" ? [`${FIZZLE_LINE} (${e.forbidden}) ${DISCLOSE_FIZZLE_AGAIN}`] : []);

// One line of verdict, above the banner so the past reads above the future. The prose and the lesson are one tap away.
function discloseStrip(entry: LogEntry | undefined, enemy: Enemy, firstCast: boolean): HTMLElement {
  const box = el("div", "verdict");
  box.setAttribute("aria-live", "polite"); // the Reveal fills this same box, so its beats are announced
  if (entry?.kind !== "turn") {
    if (entry?.kind === "fizzle") box.append(el("span", "said", discloseSaid(entry)[0]));
    else if (firstCast) box.append(el("span", "hint", DISCLOSE_FIRST_HINT));
    else box.classList.add("blank"); // turn 0 of a later Battle: nothing to report, no gap
    return box;
  }
  const [hit, cost] = discloseValues(entry);
  box.append(
    el("span", "half off", el("i", "lbl", "Offence"), el("i", "pips", pips(entry.offence)), el("b", entry.immune || entry.hollow ? "tag" : "", hit)),
    el("span", "half def", el("i", "lbl", "Defence"), el("i", "pips", entry.instantKill ? "—" : pips(entry.defence)), el("b", entry.playerHpLost ? "cost" : "", cost)),
  );
  const more = el("details", "");
  // The lesson pushes itself the first time this kind of negation happens in the Battle; after that it is one tap away.
  // Matching on `reason` counts only negated Turns of the same kind, and ignores Fizzles and the Phase divider.
  more.open = !!entry.reason && log.filter((e) => e.kind === "turn" && e.reason === entry.reason).length === 1;
  more.append(
    el("summary", entry.reason ? "why" : "", entry.reason ? "Why?" : "Detail"),
    el("p", "", (entry.immune && enemy.immunity?.line) || (entry.hollow && HOLLOW_LINE) || (entry.instantKill ? INSTANT_KILL_LINE : OFFENCE_LINES[entry.offence])),
    el("p", "", entry.instantKill ? KILL_LINE : DEFENCE_LINES[entry.defence]),
    ...(entry.reason ? [el("p", "lesson", entry.reason)] : []),
  );
  box.append(more);
  return box;
}

// One line per Turn: its outcome is readable closed, the spell, the Attack, the pips and the lesson open on demand.
function discloseLogRow(e: DiscloseTurn): HTMLElement {
  const row = el("details", "");
  const [hit, cost] = discloseValues(e);
  row.append(
    el("summary", "", el("b", "", `Turn ${e.turn}`), el("q", "", e.spell), el("span", "tag", icon("crossed-swords"), hit)),
    el("small", "", e.attack),
    el("div", "scores", el("span", "", `Offence ${pips(e.offence)}`), el("span", "", `Defence ${e.instantKill ? "—" : pips(e.defence)} · ${cost}`)),
    ...(e.reason ? [el("small", "lesson", e.reason)] : []),
  );
  return row;
}

function discloseLog(): HTMLElement {
  const rows = log.map((e) => (e.kind === "phase" ? el("li", "divider", "the barrier breaks") : e.kind === "fizzle" ? el("li", "fizzle", el("q", "", e.spell), el("span", "tag", "fizzled")) : el("li", "", discloseLogRow(e))));
  const turns = log.filter((e) => e.kind === "turn").length;
  const box = el("details", "log");
  box.open = matchMedia("(min-width: 900px)").matches; // the wide layout has a column to spare; on a phone the log is never the next action
  box.append(
    el("summary", "", el("h2", "", "Combat log"), el("span", "count", turns ? `${turns} turn${turns === 1 ? "" : "s"}` : "")),
    rows.length ? el("ol", "", ...rows) : el("p", "", "No spells cast yet."),
  );
  return box;
}

// A mouse click on a summary takes focus off the Spell; hand it straight back so the caret never leaves it. Keyboard
// activation (detail 0) keeps its place in the tab order, and on touch refocusing would pop the keyboard over the
// detail just opened.
addEventListener("click", (e) => {
  if (variant !== "disclose" || e.detail === 0 || !matchMedia("(pointer: fine)").matches) return;
  if ((e.target as Element).closest?.("summary")) app.querySelector("textarea")?.focus();
});

function render() {
  dropMoment?.(); // this render replaces the DOM the open card's listeners were closing over
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
        // The description is turn-0 information: in "moment" it retires once the fight is under way.
        ...(isMoment() && turn > 0 ? [] : [el("p", "", enemy.description)]),
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
      moment = null;
      render();
    };
    const endLine = variant === "subtract" ? subEndLine() : run.playerHp === 0 ? LOSE_LINE : ended ? WIN_LINE : phaseChange ? BARRIER_BREAKS_LINE : `The ${enemy.name} falls.`;
    if (isMoment() && moment) {
      // The end card is the same card, made modal: the outcome and what it ended, with only its button as the way out.
      stage.append(you);
      openMoment(moment, stage, el("h3", "end-line", endLine), next);
    } else stage.append(variant === "subtract" ? turnSlot() : variant === "disclose" ? discloseStrip(log[0], enemy, false) : el("div", "result", result), el("div", "end", el("h2", "", endLine), next), you);
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
    moment = log[0]; // the outcome the "moment" card shows, and re-shows if the variant is switched away and back
    track("cast", { enemy: enemy.name, enemy_index: before.enemy, turn: castTurn, attack, hand: castHand, spell: input.value, ...verdict, enemy_hp_before: before.enemyHp, enemy_hp_after: run.enemyHp, player_hp_before: before.playerHp, player_hp_after: run.playerHp });
    if (run.playerHp === 0 || isWon(run)) track("run_ended", { outcome: run.playerHp === 0 ? "lost" : "won", enemy: enemy.name, enemy_index: run.enemy, player_hp: run.playerHp });
    result = lines.join("\n");
    await playReveal(revealCues(verdict, enemy, before, run), { stage, portrait, enemyBar, you, resultBox, banner }, variant === "disclose" ? discloseSaid(log[0]) : lines, run, enemy.hp);
    busy = false;
    render(); // the end state, whether the Reveal played out or was skipped
    if (run.playerHp === 0) effect("lose");
    else if (isWon(run)) effect("win");
  };
  const banner = el("div", "attack", icon("crossed-swords"), el("div", "", el("small", "", isMoment() ? `Incoming · Turn ${turn + 1}` : "Incoming"), attack));
  // In "moment" the result box is left out of the stage: playReveal still writes to it, so only its animations,
  // floats, shake and HP tweens land, and the prose goes nowhere.
  const resultBox = variant === "subtract" ? turnSlot() : variant === "disclose" ? discloseStrip(log[0], enemy, turn === 0 && run.enemy === 0) : el("div", "result", result);
  stage.append(
    // subtract and disclose put the Turn just played (the past) above the Incoming banner (the future)
    ...(variant === "subtract" || variant === "disclose" ? [resultBox, banner] : isMoment() ? [banner] : [banner, resultBox]),
    el("div", "hand", ...tiles),
    el("div", "casting", el("div", "scroll", input, el("div", "limits", usedCount, total)), el("div", "cast-row", you, cast)),
  );
  if (isMoment() && moment) openMoment(moment, stage);
  else input.focus();
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
