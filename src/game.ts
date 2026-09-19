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

export const wordCount = (spell: string) => spell.trim().split(/\s+/).filter(Boolean).length;

export const canCast = (spell: string, hand: string[]) =>
  wordCount(spell) <= TUNING.maxSpellWords && usedHandWords(spell, hand).length >= TUNING.minHandWords;

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

// Boss phase 1: the next entry is the same enemy, so the Battle continues.
export const isPhaseChange = (run: Run) => ENEMIES[run.enemy + 1]?.name === ENEMIES[run.enemy].name;

export const isWon = (run: Run) => run.enemyHp === 0 && run.enemy === ENEMIES.length - 1;

// An immune enemy takes nothing from a spell that relies on its immunity, and a hollow spell hurts nothing, whatever the offence score was.
export const offenceOf = (verdict: { offence: number; immune?: boolean; hollow?: boolean }) => (verdict.immune || verdict.hollow ? 0 : verdict.offence);

// Offence lands first, but only an instant kill stops the attack: a dying enemy still strikes (spec "Instant kill").
export function applyCast(run: Run, enemy: Pick<Enemy, "power" | "instantKill">, verdict: { offence: number; defence: number; immune?: boolean; hollow?: boolean }): Run {
  const offence = offenceOf(verdict);
  const kill = enemy.instantKill && offence === 5;
  const enemyHp = kill ? 0 : Math.max(0, run.enemyHp - damageDealt(offence));
  const playerHp = kill ? run.playerHp : Math.max(0, run.playerHp - damageTaken(enemy.power, verdict.defence));
  return { ...run, enemyHp, playerHp };
}

// Combat log of the current Battle, newest entry first. Flavour lines are not stored.
export type LogEntry =
  | { kind: "turn"; turn: number; spell: string; attack: string; offence: number; defence: number; enemyHpLost: number; playerHpLost: number; immune: boolean; hollow: boolean; instantKill: boolean; reason: string }
  | { kind: "fizzle"; spell: string; forbidden: string }
  | { kind: "phase" };

// `offence` is the effective one: 0 when negated. `reason` is the player-facing why, empty when nothing was negated.
export function logTurn(log: LogEntry[], spell: string, attack: string, enemy: Pick<Enemy, "instantKill">, verdict: { offence: number; defence: number; immune?: boolean; hollow?: boolean }, before: Run, after: Run, reason = ""): LogEntry[] {
  const offence = offenceOf(verdict);
  const turn = log.filter((e) => e.kind === "turn").length + 1;
  return [{ kind: "turn", turn, spell, attack, offence, defence: verdict.defence, enemyHpLost: before.enemyHp - after.enemyHp, playerHpLost: before.playerHp - after.playerHp, immune: !!verdict.immune, hollow: !!verdict.hollow, instantKill: enemy.instantKill && offence === 5, reason }, ...log];
}

export const logFizzle = (log: LogEntry[], spell: string, forbidden: string): LogEntry[] => [{ kind: "fizzle", spell, forbidden }, ...log];

// Call with the run *before* nextEnemy: a new Battle clears the log, the boss's Phase change keeps it under a divider.
export const logNextEnemy = (log: LogEntry[], run: Run): LogEntry[] => (isPhaseChange(run) ? [{ kind: "phase" }, ...log] : []);

// Reveal cues: the ordered beats of one Verdict's playback. The DOM and audio layers only play them; they decide nothing.
// `hit` intensity is the effective Offence 0-5, `hurt` intensity is the damage taken.
export type Cue =
  | { kind: "cast" | "fizzle" | "immune" | "hollow" | "instant-kill" | "enemy-death" | "barrier-shatter" | "attack-lands" | "shield" | "player-death" }
  | { kind: "hit"; intensity: number; damage: number }
  | { kind: "hurt"; intensity: number };

export function revealCues(verdict: { forbidden?: string; offence: number; defence: number; immune?: boolean; hollow?: boolean }, enemy: Pick<Enemy, "instantKill">, before: Run, after: Run): Cue[] {
  if (verdict.forbidden && verdict.forbidden !== "none") return [{ kind: "cast" }, { kind: "fizzle" }];
  const offence = offenceOf(verdict);
  const instant = enemy.instantKill && offence === 5;
  const cues: Cue[] = [{ kind: "cast" }, verdict.immune ? { kind: "immune" } : verdict.hollow ? { kind: "hollow" } : instant ? { kind: "instant-kill" } : { kind: "hit", intensity: offence, damage: before.enemyHp - after.enemyHp }];
  // Only an instant kill skips the Attack beat: a dying enemy still strikes, then falls.
  if (!instant) {
    cues.push({ kind: "attack-lands" });
    if (verdict.defence >= 4) cues.push({ kind: "shield" });
    if (after.playerHp < before.playerHp) cues.push({ kind: "hurt", intensity: before.playerHp - after.playerHp });
  }
  if (after.enemyHp === 0) cues.push({ kind: isPhaseChange(after) ? "barrier-shatter" : "enemy-death" });
  if (after.playerHp === 0) cues.push({ kind: "player-death" });
  return cues;
}
