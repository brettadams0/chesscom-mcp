# Changelog

Notable changes to this server. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The version is the
server's, as reported to clients in `initialize`; the tool surface itself is
recorded in [`mcp-surface.json`](mcp-surface.json).

## [1.1.0] — 2026-10-16

### Changed

- `chess_get_games_by_month` returns a summary of each game by default —
  players, ratings, results, time control, opening and link — without the PGN,
  `tcn` move encoding, final position or redundant UUIDs. A busy month went
  from 2.27 MB to 238 KB, small enough to reach the model intact. Pass
  `includePgn: true` for the full records.
- Tool results are compact JSON rather than indented.
- The server and its User-Agent report the version from `package.json`.

### Added

- `timeClass` filter on `chess_get_games_by_month`.
- `mcp-surface.json` and a CI step that fails when the tool surface drifts
  from it. ESLint, Dependabot, Node 24 in the CI matrix.

### Fixed

- Usernames and club ids are validated before they reach the request path;
  `encodeURIComponent` let `..` through.
- Every request has a 30-second timeout; a 429 reports when to retry, and
  error bodies are trimmed.

### Security

- Dependencies raised to clear every open `npm audit` advisory, including a
  critical one in `proxy-addr` and a high one in the MCP SDK's OAuth client.

## [1.0.0] — 2026-07-28

First public release: 9 read-only tools, offline tests and CI.

[1.1.0]: https://github.com/brettadams0/chesscom-mcp/compare/865bc03...HEAD
[1.0.0]: https://github.com/brettadams0/chesscom-mcp/tree/865bc03
