# Spellcrafting Duel

A single-player game where the player defeats hand-authored enemies by typing free-text spells that an AI judge scores.

## Language

### The run

**Run**:
One attempt at the full ladder of enemies, from the first enemy until the player wins or reaches 0 HP.
_Avoid_: Game, session, playthrough

**Battle**:
The fight against one named enemy, from its first turn until it dies or the player does. Both boss phases are one Battle.
_Avoid_: Fight, encounter, level, round

**Phase**:
One of the two stages of the boss's Battle: the barrier, then the exposed boss.

**Turn**:
One enemy Attack answered by one judged Cast. A Fizzle does not complete a Turn.
_Avoid_: Round, move

**Attack**:
The authored action the enemy takes this Turn, shown to the player before they write.
_Avoid_: Move, enemy spell

### Casting

**Hand**:
The random words offered to the player this Turn, some of which the Spell must use.
_Avoid_: Cards, deck, word list

**Spell**:
The free text the player writes to answer the Attack and hurt the enemy.
_Avoid_: Prompt, input, message

**Cast**:
Submitting a Spell for judgment.
_Avoid_: Submit, send, play

**Fizzle**:
A Cast rejected as Forbidden: nothing happens and the player rewrites against the same Hand and Attack.
_Avoid_: Rejection, error, fail

**Forbidden**:
Spell content the game refuses to judge, such as slurs or text addressing the Judge.
_Avoid_: Banned, moderated, blocked

### Judgment

**Judge**:
The AI that reads the same text the player reads and scores a Cast.
_Avoid_: Model, AI, referee

**Verdict**:
The Judge's complete answer to one Cast: Forbidden category, Offence, Defence, Hollow and Immunity.
_Avoid_: Result, response, score

**Offence**:
The 0–5 score for how believably the Spell would hurt this enemy.
_Avoid_: Attack score, damage score

**Defence**:
The 0–5 score for how well the Spell answers this Turn's Attack.
_Avoid_: Block, guard score

**Immunity**:
A kind of magic, shown to the player up front, that cannot hurt a particular enemy.
_Avoid_: Resistance, weakness

**Hollow**:
A Spell that only declares its result or claims power without any means. The Judge flags it separately, and its Offence is negated to 0 whatever it scored.
_Avoid_: No-mechanism, empty, "I win" spell

**Instant kill**:
An Offence of 5 against a non-boss enemy, which ends the Battle before the Attack lands.
_Avoid_: One-shot, crit

### Presentation

**Reveal**:
The staged playback of a Verdict: the Spell lands, then the Attack lands, each with its own beat.
_Avoid_: Animation, result screen, cutscene

**Combat log**:
The running record of every Turn and Fizzle in the current Battle.
_Avoid_: History, feed, transcript

**Portrait**:
The image that represents an enemy on the stage.
_Avoid_: Sprite, avatar, icon

**Barrier**:
The magical shield that must be broken in the boss's first Phase before the boss can be hurt.
_Avoid_: Shield, bubble, force field
