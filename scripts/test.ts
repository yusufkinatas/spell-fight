// Pure game logic checks. Run: npm test
import assert from "node:assert/strict";
import { ENEMIES, FORBIDDEN_LABELS, WORDS } from "../src/content.ts";
import { TUNING, applyCast, canCast, damageTaken, drawHand, isWon, newRun, nextEnemy, usedHandWords } from "../src/game.ts";
import { FORBIDDEN_OPTIONS } from "../src/judge.ts";

const hand = ["river", "thorn", "flame", "ash", "whisper", "iron"];

// Hand validation: whole words, case-insensitive, inflections count, each hand word counts once.
assert.deepEqual(usedHandWords("RIVER of Thorns", hand), ["river", "thorn"]);
assert.deepEqual(usedHandWords("flaming whispers, whispering", hand), ["flame", "whisper"]);
assert.deepEqual(usedHandWords("a driver crashes", hand), [], "no match inside a word");
assert.equal(canCast("river thorn", hand), false, "two hand words is not enough");
assert.equal(canCast("river river river", hand), false, "a repeated word counts once");
assert.equal(canCast("River thorns burn with flaming ash", hand), true);
assert.equal(canCast("river thorn ash " + "la ".repeat(12), hand), true, "15 words allowed");
assert.equal(canCast("river thorn ash " + "la ".repeat(13), hand), false, "16 words is too long");

// Hands: 6 distinct pool words.
const drawn = drawHand();
assert.equal(new Set(drawn).size, TUNING.handSize);
assert.ok(drawn.every((w) => WORDS.includes(w)));
assert.equal(new Set(WORDS).size, WORDS.length, "no duplicate pool words");

// HP math: power 3 -> 3,2,2,1,1,0 for defence 0..5.
assert.deepEqual([0, 1, 2, 3, 4, 5].map((d) => damageTaken(3, d)), [3, 2, 2, 1, 1, 0]);
const golem = { power: 3, instantKill: true };
assert.deepEqual(applyCast({ enemy: 0, enemyHp: 8, playerHp: 20 }, golem, { offence: 4, defence: 1 }), { enemy: 0, enemyHp: 4, playerHp: 18 });
assert.deepEqual(applyCast({ enemy: 0, enemyHp: 8, playerHp: 2 }, golem, { offence: 0, defence: 0 }), { enemy: 0, enemyHp: 8, playerHp: 0 }, "HP floors at 0");
assert.deepEqual(applyCast({ enemy: 0, enemyHp: 3, playerHp: 1 }, golem, { offence: 3, defence: 0 }), { enemy: 0, enemyHp: 0, playerHp: 0 }, "only an instant kill skips the attack: a dying enemy still strikes");

// Instant kill: offence 5 kills at any HP and the attack never lands; an enemy that opts out just takes max damage.
assert.deepEqual(applyCast({ enemy: 0, enemyHp: 99, playerHp: 1 }, golem, { offence: 5, defence: 0 }), { enemy: 0, enemyHp: 0, playerHp: 1 });
assert.deepEqual(applyCast({ enemy: 0, enemyHp: 14, playerHp: 20 }, { power: 5, instantKill: false }, { offence: 5, defence: 0 }), { enemy: 0, enemyHp: 8, playerHp: 15 });

// Immunity: a spell relying on it does 0 damage (no instant kill either), and the enemy still attacks.
assert.deepEqual(applyCast({ enemy: 3, enemyHp: 12, playerHp: 20 }, golem, { offence: 5, defence: 0, immune: true }), { enemy: 3, enemyHp: 12, playerHp: 17 });
assert.deepEqual(applyCast({ enemy: 3, enemyHp: 12, playerHp: 20 }, golem, { offence: 4, defence: 5, immune: false }), { enemy: 3, enemyHp: 8, playerHp: 20 });

// The run: 20 HP at enemy 1, player HP carries over with no healing, the win is the last enemy's death.
assert.deepEqual(newRun(), { enemy: 0, enemyHp: ENEMIES[0].hp, playerHp: 20 });
let run = applyCast(newRun(), ENEMIES[0], { offence: 0, defence: 0 });
run = applyCast(run, ENEMIES[0], { offence: 5, defence: 0 });
assert.equal(isWon(run), false);
run = nextEnemy(run);
assert.deepEqual(run, { enemy: 1, enemyHp: ENEMIES[1].hp, playerHp: 20 - ENEMIES[0].power }, "HP carries over");
while (run.enemy < ENEMIES.length - 1) run = nextEnemy(run);
assert.equal(isWon(run), false);
assert.equal(isWon({ ...run, enemyHp: 0 }), true);

// Final boss: the last two entries share a name and are exempt from instant kill. Offence 5 deals 6 and the boss
// still attacks; breaking the barrier neither heals nor hurts the player; only phase 2's death wins.
const [barrier, boss] = ENEMIES.slice(-2);
assert.equal(barrier.name, boss.name);
assert.deepEqual(ENEMIES.map((e) => e.instantKill), ENEMIES.map((_, i) => i < ENEMIES.length - 2));
for (const phase of [barrier, boss])
  assert.deepEqual(applyCast({ enemy: 0, enemyHp: phase.hp, playerHp: 20 }, phase, { offence: 5, defence: 0 }), { enemy: 0, enemyHp: phase.hp - 6, playerHp: 20 - phase.power });
run = applyCast({ enemy: ENEMIES.length - 2, enemyHp: 6, playerHp: 9 }, barrier, { offence: 5, defence: 0 });
assert.equal(isWon(run), false, "breaking the barrier is not a win");
assert.equal(run.playerHp, 9 - barrier.power, "the boss still attacks on the turn its barrier breaks");
assert.deepEqual(nextEnemy(run), { enemy: ENEMIES.length - 1, enemyHp: boss.hp, playerHp: run.playerHp }, "no heal on phase change");

// Content shape: 3 attacks each, difficulty rises, ~70 words.
assert.ok(ENEMIES.every((e) => e.attacks.length === 3));
assert.ok(ENEMIES.every((e, i) => i === 0 || e.power >= ENEMIES[i - 1].power));
assert.ok(WORDS.length >= 65 && WORDS.length <= 75);

// Every forbidden category the judge can return has a player-facing label.
assert.deepEqual(Object.keys(FORBIDDEN_OPTIONS).sort(), ["none", ...Object.keys(FORBIDDEN_LABELS)].sort());

console.log("ok");
