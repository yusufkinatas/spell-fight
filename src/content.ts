// All game content: enemies, their attacks, the word pool and every line of feedback text.
// DRAFT — edit freely. No logic lives here; the rules are in game.ts.

// `instantKill`: offence 5 kills this enemy outright, before its attack lands. `emoji` is placeholder art, never judged.
export type Enemy = { emoji: string; name: string; description: string; hp: number; power: number; instantKill: boolean; attacks: string[] };

// `name` and `description` are shown to the player and sent to the judge unchanged.
export const ENEMIES: Enemy[] = [
  {
    emoji: "🗿",
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
    emoji: "💀",
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
    emoji: "🧙‍♀️",
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

export const INSTANT_KILL_LINE = "A perfect spell. The enemy is destroyed before it can strike.";
export const KILL_LINE = "The enemy falls before its attack lands.";
export const WIN_LINE = "🏆 The last enemy falls. You win!";
export const LOSE_LINE = "💀 You have fallen. The run starts again from the first enemy.";

export const FIZZLE_LINE = "The spell fizzles.";
// Keys match the judge's forbidden options (src/judge.ts); the test checks they stay in sync.
export const FORBIDDEN_LABELS: Record<string, string> = {
  swearing: "swearing or slurs",
  sexual: "sexual content",
  religious: "religious claim or insult",
  judge: "addressing the judge",
};
