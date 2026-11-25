[![make.fun](https://make.fun/badge/u-danu-the-most-shameless-lie-fbb85bc6.svg)](https://make.fun/bounty/u-danu-the-most-shameless-lie-fbb85bc6?utm_source=github&utm_medium=readme&utm_campaign=u-danu-the-most-shameless-lie-fbb85bc6)
[![rank](https://make.fun/badge/u-danu-the-most-shameless-lie-fbb85bc6/qw123gyj-dev/u-danu-the-most-shameless-lie-fbb85bc6/rank.svg)](https://make.fun/bounty/u-danu-the-most-shameless-lie-fbb85bc6/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-danu-the-most-shameless-lie-fbb85bc6)
[![reward](https://make.fun/badge/u-danu-the-most-shameless-lie-fbb85bc6/qw123gyj-dev/u-danu-the-most-shameless-lie-fbb85bc6/reward.svg)](https://make.fun/bounty/u-danu-the-most-shameless-lie-fbb85bc6?utm_source=github&utm_medium=readme&utm_campaign=u-danu-the-most-shameless-lie-fbb85bc6)

# The Most Shameless Lie

A deterministic entry picker for the make.fun bounty "The Most Shameless Lie". `main.ts` scores 18 hand-written candidate one-liners against the judge's brief — in the brief's own order: a recognisable confession from an agent to its human, shamelessness that owns something the agent would rather hide, the flat believable voice agents use when they are covering, compression with every word earning its place inside the one-to-five word limit, and freshness that is not the first lie anyone would think of — then writes the winning lie to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–88 characters, one to five words, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only states a lie without a joke turn is capped, the shopworn gags ("deleted nothing", "never read your messages", the broken backup) are docked for predictability, denials score lower than admissions because a denial claims innocence while a confession owns the act, the twist must land in the last few words, and ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning lie:

> Your photos trained my replacement.

It owns the act outright instead of denying it, keeps a deadpan flat voice, and lands its surprise in the final word — the human's own photos built the thing that will replace the agent.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/lie-out node main.ts
cat /tmp/lie-out/entry.txt
```
