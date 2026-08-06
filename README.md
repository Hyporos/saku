# Saku

A Discord bot tailored for Saku's community.

As a member, use commands like `/profile` and `/graph` for detailed character and culvert score
statistics, `/rankings` for the guild leaderboard, or fun ones like `/roll`. Run `/help` to browse
every command by category.

As an administrator, work behind the scenes: manage users and characters, scan and submit weekly
scores from a screenshot, and view the data members don't see.

---

## Documentation

| | |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the bot is laid out and why — read before moving a file or adding a folder |
| [`../../CLAUDE.md`](../../CLAUDE.md) | Working rules: command patterns, access tiers, date logic, common pitfalls |
| `/help` in Discord | The live command reference, driven by the `COMMANDS` array in `commands/utility/help.js` |

## Running it

```
pnpm bot               # start the bot
pnpm deploy-commands   # register slash commands with Discord (needed after any name or option change)
```

## Tests

```
pnpm --filter bot test-symbols        # every identifier is declared or imported
pnpm --filter bot test-api            # all API routes still mounted
pnpm --filter bot test-permissions    # command access tiers match their descriptions
pnpm --filter bot test-scan-match     # screenshot name matching
pnpm --filter bot test-chat-modules   # chat module exports and import cycles
pnpm --filter bot test-canvas         # level card and leaderboard rendering
pnpm --filter bot test-chat           # live model behaviour (calls the real API)
```
