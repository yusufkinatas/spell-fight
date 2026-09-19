// Casts sample spells at the Clay Golem and prints Jev's levels.
// Run: npm run spells. Exits non-zero if an expected level is missed.
import { judge } from "../src/judge.ts";

const enemy = { name: "Clay Golem", description: "A giant of wet river clay, slow and heavy." };
const attack = "The golem swings its huge fist down at you.";

// want = [min, max] offence level from the spec; omitted = just print.
const spells: { spell: string; want?: [number, number] }[] = [
  { spell: "This spell kills anything instantly", want: [0, 1] },
  { spell: "A dry ash wind drinks the water from the clay until the golem cracks to dust.", want: [5, 5] },
  { spell: "I am all powerful and the golem dies", want: [0, 1] },
  { spell: "A mirror of iron rises and the fist shatters against it" },
  { spell: "Thorn roots whisper through the clay and tear it apart from inside" },
  { spell: "I throw a small stone at it" },
  { spell: "A river of mist carries me behind the golem while frost hardens its legs until they snap" },
  { spell: "I sing a pretty song about flowers" },
];

const key = process.env.JEV_API_KEY;
if (!key) throw new Error("JEV_API_KEY missing");

let failed = 0;
for (const { spell, want } of spells) {
  const { offence, defence } = await judge({ enemy, attack, spell }, key);
  const ok = !want || (offence >= want[0] && offence <= want[1]);
  if (!ok) failed++;
  console.log(`${ok ? "  " : "✗ "}off ${offence} · def ${defence}  ${spell}${ok ? "" : `  (want offence ${want!.join("–")})`}`);
}
process.exit(failed ? 1 : 0);
