// Pure game logic checks. Run: npm test
import assert from "node:assert/strict";
import { TUNING, WORDS, applyCast, canCast, damageTaken, drawHand, usedHandWords } from "../src/game.ts";

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
assert.deepEqual(applyCast({ enemyHp: 8, playerHp: 20 }, 3, { offence: 4, defence: 1 }), { enemyHp: 4, playerHp: 18 });
assert.deepEqual(applyCast({ enemyHp: 8, playerHp: 2 }, 3, { offence: 0, defence: 0 }), { enemyHp: 8, playerHp: 0 }, "HP floors at 0");
assert.deepEqual(applyCast({ enemyHp: 3, playerHp: 1 }, 3, { offence: 3, defence: 0 }), { enemyHp: 0, playerHp: 1 }, "offence first: a dead enemy does not attack");

console.log("ok");
