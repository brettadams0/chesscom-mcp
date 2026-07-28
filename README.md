# chesscom-mcp

[![CI](https://github.com/brettadams0/chesscom-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/brettadams0/chesscom-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](package.json)

An MCP server over the [Chess.com public data API](https://www.chess.com/news/view/published-data-api).
Read-only, and the upstream API needs no authentication — there is no token to
manage and nothing to expire, which makes this the simplest of the set.

Runs over stdio and is registered in `~/.claude.json` as `chesscom`.

## Tools

| Tool | Purpose |
|---|---|
| `chess_get_profile` | Public profile — name, title, country, followers, join date |
| `chess_get_stats` | Ratings and W/L/D per format (bullet, blitz, rapid, daily, puzzles) |
| `chess_get_current_games` | Daily/correspondence games in progress; `onlyMyTurn` filters to games awaiting a move |
| `chess_get_game_archives` | Index of available monthly archive URLs for a player |
| `chess_get_games_by_month` | Every game a player played in a given year/month, with PGNs |
| `chess_get_titled_players` | Usernames holding a given title (GM, IM, FM, …) |
| `chess_get_leaderboards` | Current Chess.com leaderboards across all categories |
| `chess_get_club` | Club profile by URL-ID |
| `chess_get_clubs` | Clubs a given player belongs to |

## Layout

```
src/client.js   thin fetch wrapper over api.chess.com/pub, shared error handling
src/chess.js    all nine tool registrations
src/index.js    McpServer construction + stdio transport
```

## Running it

```bash
npm ci
npm start        # stdio server; expects an MCP client on the other end
```

Registered for Claude Code with:

```bash
claude mcp add chesscom -- node <path>/chesscom-mcp/src/index.js
```

## Tests

```bash
npm test
```

Registration plus the fetch wrapper's URL, headers and error handling, using a
stubbed `fetch`. No network calls, so it is safe in CI.

## Notes

- The upstream API is rate-limited but generous, and serves cached responses.
  Bursts of `chess_get_games_by_month` across many months are the realistic way
  to hit a limit.
- Usernames are case-insensitive upstream but are URL-encoded here before use.
- `credentials/` and `.env` are gitignored on principle even though this server
  has no secrets today — so that adding auth later can't leak one by accident.
