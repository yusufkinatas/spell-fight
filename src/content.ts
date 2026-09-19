// All game content: enemies, their attacks, the word pool and every line of text, in English. The Turkish twin is content.tr.ts.
// DRAFT — edit freely. No logic lives here; the rules are in game.ts.

// `instantKill`: offence 5 kills this enemy outright, before its attack lands. `portrait` names a glyph in icons.ts, never judged. `music` names a track in audio.ts; both boss Phases share one so it plays on through the Phase change.
// `immunity`: shown on the enemy card as "Immune to <to>." A spell that mainly relies on <to> does 0 damage.
import type { Slot } from "./audio.ts";

export type Enemy = { portrait: string; music: Slot; name: string; description: string; hp: number; power: number; instantKill: boolean; attacks: string[]; immunity?: { to: string } };

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
    immunity: { to: "fire and heat" },
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

// Every line the player reads, per language. English is the judge's canon: ENEMIES above is what /api/judge sees in
// either language, and another language (content.tr.ts) only re-labels it by index. The Spell goes to the judge as written.
export const EN = {
  code: "en" as "en" | "tr",
  langName: "English",
  title: "Spell Fight",
  words: WORDS,
  // `immunity` is the phrase that immuneBadge and immuneHint wrap.
  enemies: ENEMIES.map((e) => ({ name: e.name, description: e.description, attacks: e.attacks, immunity: e.immunity?.to })),
  premise: "Six words in your hand, a monster at your throat. Write the spell that saves you.",
  begin: "Begin",
  // The text around the four credit links on the title screen.
  credits: ["Icons by Lorc, Delapouite and Cathelineau (", ", ", "). Music by Kevin MacLeod (", ", ", ") and Juhani Junkala (CC0). Spells and visits are logged anonymously to improve the game."],
  // Shown when a boss phase falls and the next entry has the same name.
  barrierBreaks: "The barrier shatters. The boss stands exposed!",
  win: "The last enemy falls. You win!",
  lose: "You have fallen. The run starts again from the first enemy.",
  falls: (name: string) => `The ${name} falls.`,
  // Keys match the judge's forbidden options (src/judge.ts); the test checks they stay in sync.
  forbidden: { swearing: "swearing or slurs", sexual: "sexual content", religious: "religious claim or insult", judge: "addressing the judge" } as Record<string, string>,
  // Why a judged Offence was negated: the whole lesson in one line under the struck pips. The chip beside them already says HOLLOW or IMMUNE.
  hollowHint: "Name the force that does the harm.",
  immuneHint: (to: string) => `Your spell relied on ${to}.`,
  immuneBadge: (to: string) => `Immune to ${to}`,
  miss: "miss",
  perfect: "perfect",
  immune: "Immune",
  hollow: "Hollow",
  kill: "Kill",
  blocked: "Blocked",
  fizzle: "Fizzle",
  fizzled: (why: string) => `Fizzled: ${why}`,
  offence: "Offence",
  defence: "Defence",
  outOf5: (label: string, score: number) => `${label} ${score} of 5`,
  logTitle: "Combat log",
  logEmpty: "No spells cast yet.",
  logBarrier: "the barrier breaks",
  enemyHp: "Enemy HP",
  yourHp: "Your HP",
  restart: "Restart",
  playAgain: "Play again",
  fightOn: "Fight on",
  nextEnemy: "Next enemy",
  placeholder: "Write your spell…",
  handWords: (used: number, min: number) => `${used}/${min} Hand words`,
  wordCount: (count: number, max: number) => `${count}/${max} words`,
  cast: "Cast",
  judging: "Judging…",
  judgeSilent: "The judge is silent. Cast again",
  incoming: "Incoming",
  music: "Music",
  effects: "Sound effects",
  on: "on",
  off: "off",
};
export type Text = typeof EN;

