import { z } from 'zod';
import { chessGet, clubId, username } from './client.js';
import { json } from './shared.js';

// Chess.com identifies players by username everywhere, and the failure mode when
// a model guesses wrong is a 404 rather than an obvious error — so say plainly
// that this is the login handle, not the display name shown on a profile.
const USERNAME = z
  .string()
  .describe('Chess.com username (the handle in chess.com/member/<username>), case-insensitive. Not the display name.');

/**
 * A month of games for an active player runs to megabytes, nearly all of it
 * the move record: `pgn`, plus `tcn` (the same moves, encoded) and the final
 * position. Clients cap tool output far below that, so the model would get a
 * truncated fragment. Questions like "how did I do this month?" need the
 * players, ratings, results and links, so the move record is opt-in, and the
 * UUIDs and API self-links that duplicate the usernames are dropped.
 */
export function summariseGame(game) {
  const { pgn: _pgn, tcn: _tcn, fen: _fen, initial_setup: _setup, uuid: _uuid, white, black, ...rest } = game;
  const player = ({ '@id': _id, uuid: _playerUuid, ...p } = {}) => p;
  return { ...rest, white: player(white), black: player(black) };
}

export function registerChessTools(server) {
  server.registerTool(
    'chess_get_profile',
    {
      title: 'Get Chess.com player profile',
      annotations: { readOnlyHint: true, openWorldHint: true },
      description: 'Public profile info (name, title, country, followers, join date) for a Chess.com username.',
      inputSchema: { username: USERNAME },
    },
    async (args) => json(await chessGet(`/player/${username(args.username)}`))
  );

  server.registerTool(
    'chess_get_stats',
    {
      title: 'Get Chess.com player stats',
      annotations: { readOnlyHint: true, openWorldHint: true },
      description: 'Rating and win/loss/draw stats per game format (bullet, blitz, rapid, daily, puzzles) for a username.',
      inputSchema: { username: USERNAME },
    },
    async (args) => json(await chessGet(`/player/${username(args.username)}/stats`))
  );

  server.registerTool(
    'chess_get_current_games',
    {
      title: 'Get in-progress daily games',
      annotations: { readOnlyHint: true, openWorldHint: true },
      description: "Daily (correspondence) games a player currently has in progress.",
      inputSchema: {
        username: USERNAME,
        onlyMyTurn: z
          .boolean()
          .optional()
          .describe('When true, return only the games where it is this player\'s turn to move. Defaults to false (all in-progress games).'),
      },
    },
    async ({ onlyMyTurn, ...args }) =>
      json(await chessGet(`/player/${username(args.username)}/games${onlyMyTurn ? '/to-move' : ''}`))
  );

  server.registerTool(
    'chess_get_game_archives',
    {
      title: 'List monthly game archive URLs',
      annotations: { readOnlyHint: true, openWorldHint: true },
      description: 'List of monthly archive URLs available for a player, going back to when they started playing.',
      inputSchema: { username: USERNAME },
    },
    async (args) => json(await chessGet(`/player/${username(args.username)}/games/archives`))
  );

  server.registerTool(
    'chess_get_games_by_month',
    {
      title: 'Get games played in a given month',
      annotations: { readOnlyHint: true, openWorldHint: true },
      description:
        'All games (rated + casual, all formats) a player completed in a specific year/month: players, ratings, results, time control and a link to each. Move records (PGN) are omitted unless includePgn is true.',
      inputSchema: {
        username: USERNAME,
        year: z.number().int().describe('Four-digit year, e.g. 2026.'),
        // The zero-padding is applied server-side; a model that sends "07" as a
        // string fails validation, so state the expected type explicitly.
        month: z
          .number()
          .int()
          .min(1)
          .max(12)
          .describe('Month as a number from 1 to 12 (1 = January). Send a plain integer, not a zero-padded string.'),
        timeClass: z
          .enum(['bullet', 'blitz', 'rapid', 'daily'])
          .optional()
          .describe('Only return games of this time class. Omit for all.'),
        includePgn: z
          .boolean()
          .optional()
          .describe('Return each game in full, including its PGN. A busy month is megabytes of it, so only set this when the moves themselves are needed. Defaults to false.'),
      },
    },
    async ({ year, month, timeClass, includePgn, ...args }) => {
      const archive = await chessGet(`/player/${username(args.username)}/games/${year}/${String(month).padStart(2, '0')}`);
      const games = (archive.games ?? []).filter((g) => !timeClass || g.time_class === timeClass);
      return json({ games: includePgn ? games : games.map(summariseGame) });
    }
  );

  server.registerTool(
    'chess_get_clubs',
    {
      title: "Get a player's clubs",
      annotations: { readOnlyHint: true, openWorldHint: true },
      description: 'Clubs a given username belongs to.',
      inputSchema: { username: USERNAME },
    },
    async (args) => json(await chessGet(`/player/${username(args.username)}/clubs`))
  );

  server.registerTool(
    'chess_get_club',
    {
      title: 'Get club details',
      annotations: { readOnlyHint: true, openWorldHint: true },
      description: 'Details for a club, identified by its URL id (the slug in chess.com/club/<url-id>).',
      inputSchema: {
        urlId: z
          .string()
          .describe('Club URL slug — the part after chess.com/club/, e.g. "team-canada". Lowercase and hyphenated, not the club\'s display name.'),
      },
    },
    async ({ urlId }) => json(await chessGet(`/club/${clubId(urlId)}`))
  );

  server.registerTool(
    'chess_get_titled_players',
    {
      title: 'List titled players',
      annotations: { readOnlyHint: true, openWorldHint: true },
      description: 'Usernames of all players holding a given title (e.g. GM, IM, FM, WGM, NM).',
      inputSchema: {
        title: z
          .enum(['GM', 'WGM', 'IM', 'WIM', 'FM', 'WFM', 'NM', 'WNM', 'CM', 'WCM'])
          .describe('Title code, uppercase. W-prefixed codes are the women\'s titles (WGM = Woman Grandmaster).'),
      },
    },
    async ({ title }) => json(await chessGet(`/titled/${title}`))
  );

  server.registerTool(
    'chess_get_leaderboards',
    {
      title: 'Get global leaderboards',
      annotations: { readOnlyHint: true, openWorldHint: true },
      description: 'Top players across daily/live formats and tactics/puzzle-rush leaderboards.',
      inputSchema: {},
    },
    async () => json(await chessGet('/leaderboards'))
  );
}
