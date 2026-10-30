# chesscom-mcp

[![CI](https://github.com/brettadams0/chesscom-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/brettadams0/chesscom-mcp/actions/workflows/ci.yml)
[![Surface checked by mcp-surface](https://img.shields.io/badge/surface-mcp--surface-7c3aed.svg)](https://github.com/brettadams0/mcp-surface)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](package.json)

An [MCP](https://modelcontextprotocol.io) server over the [Chess.com public data API](https://www.chess.com/news/view/published-data-api).
Read-only, and the upstream API needs no authentication — there is no token to
manage and nothing to expire, which makes this the simplest of the set.

9 tools. Runs locally over stdio.

## Tools

| Tool | Purpose |
|---|---|
| `chess_get_profile` | Public profile — name, title, country, followers, join date |
| `chess_get_stats` | Ratings and W/L/D per format (bullet, blitz, rapid, daily, puzzles) |
| `chess_get_current_games` | Daily/correspondence games in progress; `onlyMyTurn` filters to games awaiting a move |
| `chess_get_game_archives` | Index of available monthly archive URLs for a player |
| `chess_get_games_by_month` | Every game a player completed in a given month — summarised, optionally filtered by time class, with PGNs on request |
| `chess_get_titled_players` | Usernames holding a given title (GM, IM, FM, …) |
| `chess_get_leaderboards` | Current Chess.com leaderboards across all categories |
| `chess_get_club` | Club profile by URL-ID |
| `chess_get_clubs` | Clubs a given player belongs to |

Every tool is annotated `readOnlyHint: true`. The exact schemas the model sees
are in [`mcp-surface.json`](mcp-surface.json).

## Design notes

### A month of games is too big to hand a model whole

The archive endpoint returns every game a player finished in a month, each with
its full PGN, the same moves again in Chess.com's compact `tcn` encoding, and
the final position. For an active player that is a lot: one titled player's
September 2026 archive is **509 games**, which this server used to return as
**2.27 MB** of indented JSON. MCP clients cap tool
output far below that, so the model received a truncated fragment of JSON and
answered from whatever happened to fit.

Most questions — *how did I do this month, who beat me, what did I play most?* —
need the players, ratings, results, opening and a link, not the moves. So
`chess_get_games_by_month` now returns a summary of each game by default,
dropping the move records and the UUIDs and API self-links that duplicate the
usernames, and takes a `timeClass` filter:

| Same archive | Size |
|---|---|
| As this server used to return it (indented) | 2.27 MB |
| As the API sends it | 2.13 MB |
| Summarised | 238 KB |
| Summarised, `timeClass: "blitz"` | 137 KB |

`includePgn: true` returns the games in full when the moves themselves are the
point. Results from every tool are compact JSON rather than indented, since
indentation is pure token cost once it reaches the model.

### Usernames are validated, not just encoded

Usernames and club ids go straight into the request path, and
`encodeURIComponent` leaves `..` alone — so `../titled/GM` would quietly answer
a different question. Each is checked against the characters Chess.com allows,
which also turns a display name with a space in it into an error that says to
use the handle.

## Running it

Requires Node 20+.

```bash
npm ci
npm start        # stdio server; expects an MCP client on the other end
```

Claude Code:

```bash
claude mcp add chesscom -- node /absolute/path/to/chesscom-mcp/src/index.js
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "chesscom": {
      "command": "node",
      "args": ["/absolute/path/to/chesscom-mcp/src/index.js"]
    }
  }
}
```

## Development

```bash
npm test               # unit tests — no network
npm run lint           # ESLint
npm run surface        # start the server and diff its tool surface against mcp-surface.json
npm run surface:update # re-record mcp-surface.json after an intended change
```

With no auth to stub, the tests drive the tool handlers end to end against a
stubbed `fetch`: request URLs and headers, game summaries and filtering,
compact output, path validation, and the 404, 429, 5xx and timeout paths. CI
runs them on Node 20, 22 and 24, then starts the server with
[mcp-surface](https://github.com/brettadams0/mcp-surface) and fails if the tool
surface differs from the committed snapshot.

## Layout

```
src/shared.js    version, timeouts, error shaping, tool-result helpers
src/client.js    fetch wrapper over api.chess.com/pub, User-Agent, path validation
src/chess.js     game summaries and all nine tool registrations
src/index.js     McpServer construction + stdio transport
mcp-surface.json the committed tool surface CI compares against
```

## Notes

- Chess.com asks API consumers to identify themselves; the User-Agent carries
  the app name, version and a contact address.
- The upstream API serves cached responses and allows unlimited *serial*
  requests, but may rate-limit parallel ones. A 429 is reported with the
  `Retry-After` it sends; every request has a 30-second timeout.
- `credentials/` and `.env` are gitignored on principle even though this server
  has no secrets — so that adding auth later can't leak one by accident.

## License

MIT — see [LICENSE](LICENSE). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
