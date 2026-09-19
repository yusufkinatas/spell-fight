import { BARRIER_BREAKS_LINE, DEFENCE_LINES, ENEMIES, FIZZLE_LINE, FORBIDDEN_LABELS, INSTANT_KILL_LINE, KILL_LINE, LOSE_LINE, OFFENCE_LINES, PREMISE_LINE, WIN_LINE } from "./content.ts";
import { TUNING, applyCast, canCast, drawHand, isPhaseChange, isWon, logFizzle, logNextEnemy, logTurn, newRun, nextEnemy, offenceOf, usedHandWords, wordCount, type LogEntry } from "./game.ts";
import { icon } from "./icons.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;

let started = false; // the title screen shows until Begin; Restart and Play again never come back to it
let run = newRun();
let turn = 0;
let hand = drawHand();
let result = "";
let log: LogEntry[] = []; // the current Battle's Combat log

// `el("p", "cls", ...children)`: strings become text nodes.
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}

function hpBar(label: string, hp: number, max: number): HTMLElement {
  const fill = el("div", "hp-fill");
  fill.style.width = `${(100 * hp) / max}%`;
  const row = el("div", "hp", icon("glass-heart"), el("div", "hp-track", fill), el("span", "", `${hp}/${max}`));
  row.title = label;
  return row;
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
    started = true;
    render();
  };
  app.replaceChildren(
    el(
      "div",
      "title",
      el("div", "portrait", icon("dragon-head")),
      el("h1", "", "Spellcrafting Duel"),
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
        ") and Juhani Junkala (CC0).",
      ),
    ),
  );
  begin.focus();
}

const pips = (score: number) => "●".repeat(score) + "○".repeat(5 - score);

function renderLog(): HTMLElement {
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
            el("div", "scores", el("span", "", `Offence ${pips(e.offence)}`), el("span", "", e.immune ? "immune" : e.instantKill ? "instant kill" : `−${e.enemyHpLost} enemy HP`)),
            el("div", "scores", el("span", "", `Defence ${e.instantKill ? "—" : pips(e.defence)}`), el("span", "", `−${e.playerHpLost} HP`)),
          ),
  );
  return el("aside", "log", el("h2", "", "Combat log"), entries.length ? el("ol", "", ...entries) : el("p", "", "No spells cast yet."));
}

function render() {
  if (!started) return renderTitle();
  const enemy = ENEMIES[run.enemy];
  const phaseChange = isPhaseChange(run);
  const stage = el(
    "div",
    "stage",
    el(
      "div",
      "enemy",
      el("div", phaseChange ? "portrait barrier" : "portrait", icon(enemy.portrait)),
      el(
        "div",
        "enemy-info",
        el("h1", "", enemy.name),
        el("p", "", enemy.description),
        ...(enemy.immunity ? [el("div", "badge", icon("checked-shield"), ` Immune to ${enemy.immunity.to}`)] : []),
        hpBar("Enemy HP", run.enemyHp, enemy.hp),
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
      turn = 0;
      result = "";
      hand = drawHand();
      render();
    };
    stage.append(el("div", "result", result), el("div", "end", el("h2", "", run.playerHp === 0 ? LOSE_LINE : ended ? WIN_LINE : phaseChange ? BARRIER_BREAKS_LINE : `The ${enemy.name} falls.`), next), you);
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
    tiles.forEach((tile, i) => tile.classList.toggle("used", used.includes(hand[i])));
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
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enemy: { name: enemy.name, description: enemy.description }, attack, spell: input.value }),
      });
      if (!res.ok) throw new Error(`judge ${res.status}`);
      const verdict: { forbidden: string; offence: number; defence: number; immune: boolean } = await res.json();
      if (verdict.forbidden !== "none") {
        // Free retry: no HP change, same hand, same attack. The scores are ignored.
        const label = FORBIDDEN_LABELS[verdict.forbidden] ?? verdict.forbidden;
        result = `${FIZZLE_LINE} (${label})`;
        log = logFizzle(log, input.value, label);
        return render();
      }
      const before = run;
      run = applyCast(run, enemy, verdict);
      log = logTurn(log, input.value, attack, enemy, verdict, before, run);
      const offence = offenceOf(verdict);
      const instant = enemy.instantKill && offence === 5;
      // Only an instant kill stops the attack, so only then is there no defence line to show.
      const defenceLine = instant ? KILL_LINE : DEFENCE_LINES[verdict.defence];
      result =
        `${(verdict.immune && enemy.immunity?.line) || (instant ? INSTANT_KILL_LINE : OFFENCE_LINES[offence])} (−${before.enemyHp - run.enemyHp} enemy HP)\n` +
        `${defenceLine} (−${before.playerHp - run.playerHp} HP)\n` +
        `Offence ${offence}/5 · Defence ${verdict.defence}/5`;
      turn++;
      hand = drawHand();
      render();
    } catch (e) {
      console.error(e);
      // Same hand, same attack: the player can simply cast again.
      cast.textContent = "The judge is silent. Cast again";
      cast.disabled = input.disabled = false;
    }
  };
  stage.append(
    el("div", "attack", icon("crossed-swords"), el("div", "", el("small", "", "Incoming"), attack)),
    el("div", "result", result),
    el("div", "hand", ...tiles),
    el("div", "casting", el("div", "scroll", input, el("div", "limits", usedCount, total)), el("div", "cast-row", you, cast)),
  );
  input.focus();
}

render();
