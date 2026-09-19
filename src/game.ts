// Pure game rules (content lives in content.ts). No DOM, no network: the test script imports this.

import { ENEMIES, WORDS, type Enemy } from "./content.ts";

// Every tunable number lives here.
export const TUNING = {
  playerHp: 20,
  handSize: 6,
  minHandWords: 3,
  maxSpellWords: 15,
  // offence level -> damage dealt. Level 5 is an instant kill instead when the enemy has `instantKill`.
  offenceDamage: [0, 1, 2, 3, 4, 6],
  defenceLevels: 5, // damage taken = attack power x (5 - defence) / 5, rounded
};

// ponytail: crude stem (drop a final "e" so flame matches flaming); "ash" also matches "ashamed". Real stemmer if players notice.
const stem = (word: string) => (word.length > 3 ? word.replace(/e$/, "") : word);

export function usedHandWords(spell: string, hand: string[]): string[] {
  const tokens = spell.toLowerCase().match(/[a-z]+/g) ?? [];
  return hand.filter((word) => tokens.some((t) => t.startsWith(stem(word))));
}

export function canCast(spell: string, hand: string[]): boolean {
  const total = spell.trim().split(/\s+/).filter(Boolean).length;
  return total <= TUNING.maxSpellWords && usedHandWords(spell, hand).length >= TUNING.minHandWords;
}

export function drawHand(random = Math.random): string[] {
  const pool = [...WORDS];
  return Array.from({ length: TUNING.handSize }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]);
}

export const damageDealt = (offence: number) => TUNING.offenceDamage[offence];

export const damageTaken = (power: number, defence: number) =>
  Math.round((power * (TUNING.defenceLevels - defence)) / TUNING.defenceLevels);

// `enemy` indexes ENEMIES. Player HP carries over between fights; there is no healing.
export type Run = { enemy: number; enemyHp: number; playerHp: number };

export const newRun = (): Run => ({ enemy: 0, enemyHp: ENEMIES[0].hp, playerHp: TUNING.playerHp });

export const nextEnemy = (run: Run): Run => ({ ...run, enemy: run.enemy + 1, enemyHp: ENEMIES[run.enemy + 1].hp });

export const isWon = (run: Run) => run.enemyHp === 0 && run.enemy === ENEMIES.length - 1;

// Offence lands first: an enemy killed this turn does not get its attack in.
export function applyCast(run: Run, enemy: Pick<Enemy, "power" | "instantKill">, verdict: { offence: number; defence: number }): Run {
  const kill = enemy.instantKill && verdict.offence === 5;
  const enemyHp = kill ? 0 : Math.max(0, run.enemyHp - damageDealt(verdict.offence));
  const playerHp = enemyHp === 0 ? run.playerHp : Math.max(0, run.playerHp - damageTaken(enemy.power, verdict.defence));
  return { ...run, enemyHp, playerHp };
}
