import { BARRIER_BREAKS_LINE, DEFENCE_LINES, ENEMIES, FIZZLE_LINE, FORBIDDEN_LABELS, INSTANT_KILL_LINE, KILL_LINE, LOSE_LINE, OFFENCE_LINES, WIN_LINE } from "./content.ts";
import { TUNING, applyCast, canCast, drawHand, isWon, newRun, nextEnemy, offenceOf, usedHandWords, wordCount } from "./game.ts";
import { icon } from "./icons.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;

let run = newRun();
let turn = 0;
let hand = drawHand();
let result = "";

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

function render() {
  const enemy = ENEMIES[run.enemy];
  const phaseChange = ENEMIES[run.enemy + 1]?.name === enemy.name; // boss phase 1: the next entry is the same boss
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
  app.replaceChildren(el("div", "battle", stage));
  if (run.enemyHp === 0 || run.playerHp === 0) {
    const ended = run.playerHp === 0 || isWon(run);
    const next = el("button", "", run.playerHp === 0 ? "Restart" : ended ? "Play again" : phaseChange ? "Fight on" : "Next enemy");
    next.onclick = () => {
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
        result = `${FIZZLE_LINE} (${FORBIDDEN_LABELS[verdict.forbidden] ?? verdict.forbidden})`;
        return render();
      }
      const before = run;
      run = applyCast(run, enemy, verdict);
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
