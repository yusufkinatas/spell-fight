import { DEFENCE_LINES, ENEMIES, OFFENCE_LINES, TUNING, applyCast, canCast, drawHand, usedHandWords } from "./game.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
const enemy = ENEMIES[0];

let fight = { enemyHp: enemy.hp, playerHp: TUNING.playerHp };
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
  const over = fight.enemyHp === 0 || fight.playerHp === 0;
  app.replaceChildren(
    el("h1", `🗿 ${enemy.name}`),
    el("p", enemy.description),
    bar("Enemy", fight.enemyHp, enemy.hp),
    bar("You", fight.playerHp, TUNING.playerHp),
    el("pre", result),
  );
  if (over) {
    const again = el("button", fight.enemyHp === 0 ? "Fight again" : "Restart");
    again.onclick = () => location.reload();
    app.append(el("h2", fight.enemyHp === 0 ? `🏆 The ${enemy.name} falls. You win!` : "💀 You have fallen. Game over."), again);
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
      const verdict: { offence: number; defence: number } = await res.json();
      const before = fight;
      fight = applyCast(fight, enemy.power, verdict);
      // An enemy killed by the spell never lands its attack, so there is no defence line to show.
      const defenceLine = fight.enemyHp === 0 ? "The enemy falls before its attack lands." : DEFENCE_LINES[verdict.defence];
      result =
        `${OFFENCE_LINES[verdict.offence]} (−${before.enemyHp - fight.enemyHp} enemy HP)\n` +
        `${defenceLine} (−${before.playerHp - fight.playerHp} HP)\n` +
        `Offence ${verdict.offence}/5 · Defence ${verdict.defence}/5`;
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
