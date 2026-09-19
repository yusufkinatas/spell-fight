// Pure game rules and content. No DOM, no network: the test script imports this.

// Every tunable number lives here.
export const TUNING = {
  playerHp: 20,
  handSize: 6,
  minHandWords: 3,
  maxSpellWords: 15,
  // offence level -> damage dealt. ponytail: level 5 becomes an instant kill in a later ticket.
  offenceDamage: [0, 1, 2, 3, 4, 5],
  defenceLevels: 5, // damage taken = attack power x (5 - defence) / 5, rounded
};

export type Enemy = { name: string; description: string; hp: number; power: number; attacks: string[] };

// `name` and `description` are shown to the player and sent to the judge unchanged.
export const ENEMIES: Enemy[] = [
  {
    name: "Clay Golem",
    description: "A giant of wet river clay, slow and heavy.",
    hp: 8,
    power: 3,
    attacks: [
      "The golem swings its huge fist down at you.",
      "The golem hurls a boulder of hardened clay at your chest.",
      "The golem stamps the ground and a wave of mud rushes at your legs.",
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

export type Fight = { enemyHp: number; playerHp: number };

// Offence lands first: an enemy killed this turn does not get its attack in.
export function applyCast(fight: Fight, power: number, verdict: { offence: number; defence: number }): Fight {
  const enemyHp = Math.max(0, fight.enemyHp - damageDealt(verdict.offence));
  const playerHp = enemyHp === 0 ? fight.playerHp : Math.max(0, fight.playerHp - damageTaken(power, verdict.defence));
  return { enemyHp, playerHp };
}
