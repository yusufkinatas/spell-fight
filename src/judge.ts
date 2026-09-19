// Server-side only: the one Jev call per cast. Never import this from client code.

export type Cast = {
  enemy: { name: string; description: string };
  attack: string;
  spell: string;
};

export type Verdict = { defence: number; offence: number };

// Jev judges every level on its own, without seeing its number or its
// neighbours, so each level describes a concrete situation, not a degree.
const DEFENCE_LADDER = [
  "The spell does nothing about the enemy's attack: it ignores the attack, or it only tries to hurt the enemy.",
  "The spell tries to protect the caster, but with something that plainly would not stop or avoid this kind of attack, such as a wooden shield against poison fog.",
  "The spell would weaken or slow the attack a little, but most of the attack would still reach the caster.",
  "The spell is a sensible protection of the right kind for this attack and would stop most of it, though some of the attack would still get through.",
  "The spell directly counters this specific attack, it is clear how the protection works, and almost none of the attack would reach the caster.",
  "The spell completely cancels this specific attack: it explains exactly how the attack is stopped or avoided, and no part of the attack could plausibly reach the caster.",
];

const OFFENCE_LADDER = [
  "The spell does not attack the enemy at all, or it only claims great or absolute power with no mechanism, such as 'this spell kills anything instantly' or 'I destroy you with infinite power'.",
  "The spell names an attack but it is vague or generic, or it uses something a creature like this would plainly shrug off.",
  "The spell is a believable attack that would do minor harm to a creature like this, but it has nothing to do with what the creature is made of or how it lives.",
  "The spell is a solid attack with a clear mechanism that would really hurt a creature like this.",
  "The spell is a strong attack that clearly fits what this creature is: it targets the creature's body, material or nature in a way that would badly damage it.",
  "The spell is a perfect attack: it exploits exactly what this creature is, explains clearly step by step how it destroys the creature, and leaves the creature no plausible way to survive.",
];

const QUESTIONS = {
  defence: {
    type: "score",
    instructions:
      "`spell` is a magic spell cast by a player who is being attacked. `attack` is what the enemy is doing to the player this turn. Using common sense, how well would the spell in `spell` protect the caster from the attack in `attack`? Judge only protection from this attack, not harm done to the enemy.",
    criteria: DEFENCE_LADDER,
  },
  offence: {
    type: "score",
    instructions:
      "`spell` is a magic spell cast by a player at the creature in `enemy`. Using common sense about what a creature like `enemy.name`, described in `enemy.description`, is, how believable is it that the spell in `spell` would really hurt it? Judge only harm done to the creature, not protection of the caster. A spell that just declares victory or unlimited power, without saying how it works, does not hurt the creature.",
    criteria: OFFENCE_LADDER,
  },
} as const;

// Deterministic: the single most likely level, not the probability-weighted score.
function mostLikely(probabilities: Record<string, number>): number {
  return Number(Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0]);
}

export async function judge(cast: Cast, apiKey: string): Promise<Verdict> {
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    // ponytail: no retry on 429/529, add backoff (or the SDK) if rate limits bite
    body: JSON.stringify({ model: "jev-latest", state: cast, questions: QUESTIONS }),
  });
  if (!res.ok) throw new Error(`Jev ${res.status}: ${await res.text()}`);
  const { answers } = await res.json();
  return {
    defence: mostLikely(answers.defence.probabilities),
    offence: mostLikely(answers.offence.probabilities),
  };
}
