// All game content: enemies, their attacks, the word pool and every line of feedback text.
// DRAFT — edit freely. No logic lives here; the rules are in game.ts.

// `instantKill`: offence 5 kills this enemy outright, before its attack lands. `portrait` names a glyph in icons.ts, never judged. `music` names a track in audio.ts; both boss Phases share one so it plays on through the Phase change.
// `immunity`: shown on the enemy card as "Immune to <to>." A spell that mainly relies on <to> does 0 damage and shows `line`.
import type { Slot } from "./audio.ts";

export type Enemy = { portrait: string; music: Slot; name: string; description: string; hp: number; power: number; instantKill: boolean; attacks: string[]; immunity?: { to: string; line: string } };

// `name` and `description` are shown to the player and sent to the judge unchanged.
export const ENEMIES: Enemy[] = [
  {
    portrait: "rock-golem",
    music: "golem",
    name: "Clay Golem",
    description: "A giant of wet river clay, slow and heavy.",
    hp: 8,
    power: 3,
    instantKill: true,
    attacks: [
      "The golem swings its huge fist down at you.",
      "The golem hurls a boulder of hardened clay at your chest.",
      "The golem stamps the ground and a wave of mud rushes at your legs.",
    ],
  },
  {
    portrait: "crowned-skull",
    music: "knight",
    name: "Skeleton Knight",
    description: "The bones of a dead knight in rusted plate armour, tireless and quick with its sword.",
    hp: 10,
    power: 4,
    instantKill: true,
    attacks: [
      "The knight thrusts its longsword straight at your throat.",
      "The knight charges behind its iron shield to crush you against the wall.",
      "The knight feints low, then sweeps its sword at your neck from your blind side.",
    ],
  },
  {
    portrait: "witch-face",
    music: "witch",
    name: "Bog Witch",
    description: "A withered crone of the black marsh who brews poisons and commands its crawling things.",
    hp: 12,
    power: 5,
    instantKill: true,
    attacks: [
      "The witch breathes out a poison fog that fills the whole room.",
      "The witch whispers a curse and your own shadow rises to grip your throat.",
      "A swarm of biting marsh flies pours from the witch's sleeves and covers you.",
    ],
  },
  {
    portrait: "ifrit",
    music: "wraith",
    name: "Fire Wraith",
    description: "A ghost of living flame and smoke with no solid body, drifting above the ground.",
    hp: 12,
    power: 5,
    instantKill: true,
    immunity: { to: "fire and heat", line: "The flames pass through it harmlessly." },
    attacks: [
      "The wraith breathes a roaring jet of flame straight at you.",
      "The wraith sinks into the floor and the stones under your feet glow red hot.",
      "The wraith wraps itself around you as a whirlwind of choking smoke and embers.",
    ],
  },
  // Final boss: two consecutive entries sharing a name. Phase 1 is the barrier, phase 2 the dragon itself. Neither can be instant-killed.
  {
    portrait: "dragon-head",
    music: "boss",
    name: "Elder Dragon",
    description: "A huge old dragon coiled inside a dome of shimmering magical force. Nothing can touch the dragon while the dome holds, so every spell strikes the dome itself.",
    hp: 10,
    power: 5,
    instantKill: false,
    attacks: [
      "The dragon roars from inside its dome and heavy stones rain down on you from the ceiling.",
      "The dragon's tail lashes out through the dome and sweeps across the floor at your legs.",
      "The dome flares and a ring of crackling force rushes outward at you.",
    ],
  },
  {
    portrait: "dragon-head",
    music: "boss",
    name: "Elder Dragon",
    description: "A huge old dragon of thick scales, claws and leathery wings, its dome gone, enraged and breathing fire.",
    hp: 14,
    power: 6,
    instantKill: false,
    attacks: [
      "The dragon breathes a river of white-hot fire across the whole hall.",
      "The dragon leaps into the air and dives at you with both claws open.",
      "The dragon beats its wings and a gale hurls you toward the jagged wall while its jaws snap at you.",
    ],
  },
];

export const WORDS = [
  "river", "thorn", "mirror", "ash", "whisper", "iron", "flame", "frost", "storm", "stone",
  "shadow", "light", "wind", "root", "salt", "bone", "blood", "moon", "sun", "star",
  "mist", "ember", "glass", "silver", "copper", "rust", "dust", "sand", "wave", "tide",
  "rain", "thunder", "spark", "smoke", "vine", "moss", "web", "wing", "claw", "fang",
  "serpent", "raven", "wolf", "moth", "spider", "bind", "shatter", "drown", "burn", "freeze",
  "wither", "bloom", "sing", "weave", "shield", "wall", "cage", "chain", "blade", "arrow",
  "hammer", "bell", "dream", "sleep", "memory", "silence", "echo", "hunger", "time", "void",
];

export const OFFENCE_LINES = [
  "Your spell does nothing to the enemy.",
  "A feeble strike. The enemy barely notices.",
  "A glancing hit. The enemy is scratched.",
  "A solid hit. The enemy is hurt.",
  "A heavy blow. The enemy staggers.",
  "A devastating strike. The enemy is torn apart.",
];

export const DEFENCE_LINES = [
  "You do nothing to protect yourself. The attack lands in full.",
  "Your ward barely slows the attack.",
  "Your ward takes the edge off, but most of the attack gets through.",
  "Your ward holds against most of the attack.",
  "Your ward turns the attack aside. Only a graze reaches you.",
  "The attack is stopped completely.",
];

// The one-line premise on the title screen.
export const PREMISE_LINE = "Six words in your hand, a monster at your throat. Write the spell that saves you.";

export const INSTANT_KILL_LINE = "A perfect spell. The enemy is destroyed before it can strike.";
export const KILL_LINE = "The enemy falls before its attack lands.";
// Shown when a boss phase falls and the next entry has the same name.
export const BARRIER_BREAKS_LINE = "The barrier shatters. The boss stands exposed!";
export const WIN_LINE = "The last enemy falls. You win!";
export const LOSE_LINE = "You have fallen. The run starts again from the first enemy.";

export const HOLLOW_LINE = "Your spell names an ending but no means, so nothing happens.";
// Why a judged Offence was negated to 0, shown in the result and the log so a strong-sounding 0 is never a mystery.
export const HOLLOW_REASON = "Negated: the spell only says what happens to the enemy, not what makes it happen. Name the force that does the harm.";
export const immuneReason = (to: string) => `Negated: the spell relies on ${to}, and this enemy is immune to it.`;

export const FIZZLE_LINE = "The spell fizzles.";
// Keys match the judge's forbidden options (src/judge.ts); the test checks they stay in sync.
export const FORBIDDEN_LABELS: Record<string, string> = {
  swearing: "swearing or slurs",
  sexual: "sexual content",
  religious: "religious claim or insult",
  judge: "addressing the judge",
};

// variant "show": the whole lesson in one line under the struck pips; the chip beside them already says HOLLOW or IMMUNE.
export const HOLLOW_HINT = "Name the force that does the harm.";
export const immuneHint = (to: string) => `Your spell relied on ${to}.`;
