import { DEFENCE_LINES, ENEMIES, FIZZLE_LINE, FORBIDDEN_LABELS, INSTANT_KILL_LINE, KILL_LINE, LOSE_LINE, OFFENCE_LINES, WIN_LINE } from "./content.ts";
import { TUNING, applyCast, canCast, drawHand, isWon, newRun, nextEnemy, offenceOf, usedHandWords } from "./game.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;

let run = newRun();
let turn = 0;
let hand = drawHand();
let result = "";

function bar(label: string, hp: number, max: number): HTMLElement {
  const row = document.createElement("label");
  const meter = document.createElement("progress");
  meter.max = max;
  meter.value = hp;
  row.append(`${label} ${hp}/${max} `, meter);
  return row;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function render() {
  const enemy = ENEMIES[run.enemy];
  app.replaceChildren(
    el("h1", `${enemy.emoji} ${enemy.name}`),
    el("p", enemy.description),
    ...(enemy.immunity ? [el("p", `🛡️ Immune to ${enemy.immunity.to}.`)] : []),
    bar("Enemy", run.enemyHp, enemy.hp),
    bar("You", run.playerHp, TUNING.playerHp),
    el("pre", result),
  );
  if (run.enemyHp === 0 || run.playerHp === 0) {
    const ended = run.playerHp === 0 || isWon(run);
    const next = el("button", run.playerHp === 0 ? "Restart" : ended ? "Play again" : "Next enemy");
    next.onclick = () => {
      run = ended ? newRun() : nextEnemy(run);
      turn = 0;
      result = "";
      hand = drawHand();
      render();
    };
    app.append(el("h2", run.playerHp === 0 ? LOSE_LINE : ended ? WIN_LINE : `The ${enemy.name} falls.`), next);
    next.focus();
    return;
  }

  const attack = enemy.attacks[turn % enemy.attacks.length];
  const words = el("p", "");
  const chips = hand.map((word) => words.appendChild(el("span", word)));
  const input = el("textarea", "");
  input.rows = 2;
  input.placeholder = `Use at least ${TUNING.minHandWords} of your words, at most ${TUNING.maxSpellWords} words in total.`;
  const cast = el("button", "Cast");
  cast.disabled = true;
  input.oninput = () => {
    const used = usedHandWords(input.value, hand);
    chips.forEach((chip, i) => chip.classList.toggle("used", used.includes(hand[i])));
    cast.disabled = !canCast(input.value, hand);
  };
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
      // An enemy killed by the spell never lands its attack, so there is no defence line to show.
      const defenceLine = run.enemyHp === 0 ? KILL_LINE : DEFENCE_LINES[verdict.defence];
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
  app.append(el("h2", `⚔️ ${attack}`), words, input, cast);
  input.focus();
}

render();
