import { z } from 'zod';
import { chessGet } from './client.js';

// Chess.com identifies players by username everywhere, and the failure mode when
// a model guesses wrong is a 404 rather than an obvious error — so say plainly
// that this is the login handle, not the display name shown on a profile.
const USERNAME = z
  .string()
  .describe('Chess.com username (the handle in chess.com/member/<username>), case-insensitive. Not the display name.');

function json(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function registerChessTools(server) {
  server.registerTool(
    'chess_get_profile',
    {
      title: 'Get Chess.com player profile',
      description: 'Public profile info (name, title, country, followers, join date) for a Chess.com username.',
      inputSchema: { username: USERNAME },
    },
    async ({ username }) => json(await chessGet(`/player/${encodeURIComponent(username)}`))
  );

  server.registerTool(
    'chess_get_stats',
    {
      title: 'Get Chess.com player stats',
      description: 'Rating and win/loss/draw stats per game format (bullet, blitz, rapid, daily, puzzles) for a username.',
      inputSchema: { username: USERNAME },
    },
    async ({ username }) => json(await chessGet(`/player/${encodeURIComponent(username)}/stats`))
  );

  server.registerTool(
    'chess_get_current_games',
    {
      title: 'Get in-progress daily games',
      description: "Daily (correspondence) games a player currently has in progress.",
      inputSchema: {
        username: USERNAME,
        onlyMyTurn: z
          .boolean()
          .optional()
          .describe('When true, return only the games where it is this player\'s turn to move. Defaults to false (all in-progress games).'),
      },
    },
    async ({ username, onlyMyTurn }) =>
      json(await chessGet(`/player/${encodeURIComponent(username)}/games${onlyMyTurn ? '/to-move' : ''}`))
  );

  server.registerTool(
    'chess_get_game_archives',
    {
      title: 'List monthly game archive URLs',
      description: 'List of monthly archive URLs available for a player, going back to when they started playing.',
      inputSchema: { username: USERNAME },
    },
    async ({ username }) => json(await chessGet(`/player/${encodeURIComponent(username)}/games/archives`))
  );

  server.registerTool(
    'chess_get_games_by_month',
    {
      title: 'Get games played in a given month',
      description: 'All games (rated + casual, all formats) a player completed in a specific year/month.',
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
      },
    },
    async ({ username, year, month }) =>
      json(await chessGet(`/player/${encodeURIComponent(username)}/games/${year}/${String(month).padStart(2, '0')}`))
  );

  server.registerTool(
    'chess_get_clubs',
    {
      title: "Get a player's clubs",
      description: 'Clubs a given username belongs to.',
      inputSchema: { username: USERNAME },
    },
    async ({ username }) => json(await chessGet(`/player/${encodeURIComponent(username)}/clubs`))
  );

  server.registerTool(
    'chess_get_club',
    {
      title: 'Get club details',
      description: 'Details for a club, identified by its URL id (the slug in chess.com/club/<url-id>).',
      inputSchema: {
        urlId: z
          .string()
          .describe('Club URL slug — the part after chess.com/club/, e.g. "team-canada". Lowercase and hyphenated, not the club\'s display name.'),
      },
    },
    async ({ urlId }) => json(await chessGet(`/club/${encodeURIComponent(urlId)}`))
  );

  server.registerTool(
    'chess_get_titled_players',
    {
      title: 'List titled players',
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
      description: 'Top players across daily/live formats and tactics/puzzle-rush leaderboards.',
      inputSchema: {},
    },
    async () => json(await chessGet('/leaderboards'))
  );
}
