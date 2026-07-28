import { z } from 'zod';
import { chessGet } from './client.js';

function json(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function registerChessTools(server) {
  server.registerTool(
    'chess_get_profile',
    {
      title: 'Get Chess.com player profile',
      description: 'Public profile info (name, title, country, followers, join date) for a Chess.com username.',
      inputSchema: { username: z.string() },
    },
    async ({ username }) => json(await chessGet(`/player/${encodeURIComponent(username)}`))
  );

  server.registerTool(
    'chess_get_stats',
    {
      title: 'Get Chess.com player stats',
      description: 'Rating and win/loss/draw stats per game format (bullet, blitz, rapid, daily, puzzles) for a username.',
      inputSchema: { username: z.string() },
    },
    async ({ username }) => json(await chessGet(`/player/${encodeURIComponent(username)}/stats`))
  );

  server.registerTool(
    'chess_get_current_games',
    {
      title: 'Get in-progress daily games',
      description: "Daily (correspondence) games a player currently has in progress.",
      inputSchema: { username: z.string(), onlyMyTurn: z.boolean().optional() },
    },
    async ({ username, onlyMyTurn }) =>
      json(await chessGet(`/player/${encodeURIComponent(username)}/games${onlyMyTurn ? '/to-move' : ''}`))
  );

  server.registerTool(
    'chess_get_game_archives',
    {
      title: 'List monthly game archive URLs',
      description: 'List of monthly archive URLs available for a player, going back to when they started playing.',
      inputSchema: { username: z.string() },
    },
    async ({ username }) => json(await chessGet(`/player/${encodeURIComponent(username)}/games/archives`))
  );

  server.registerTool(
    'chess_get_games_by_month',
    {
      title: 'Get games played in a given month',
      description: 'All games (rated + casual, all formats) a player completed in a specific year/month.',
      inputSchema: { username: z.string(), year: z.number().int(), month: z.number().int().min(1).max(12) },
    },
    async ({ username, year, month }) =>
      json(await chessGet(`/player/${encodeURIComponent(username)}/games/${year}/${String(month).padStart(2, '0')}`))
  );

  server.registerTool(
    'chess_get_clubs',
    {
      title: "Get a player's clubs",
      description: 'Clubs a given username belongs to.',
      inputSchema: { username: z.string() },
    },
    async ({ username }) => json(await chessGet(`/player/${encodeURIComponent(username)}/clubs`))
  );

  server.registerTool(
    'chess_get_club',
    {
      title: 'Get club details',
      description: 'Details for a club, identified by its URL id (the slug in chess.com/club/<url-id>).',
      inputSchema: { urlId: z.string() },
    },
    async ({ urlId }) => json(await chessGet(`/club/${encodeURIComponent(urlId)}`))
  );

  server.registerTool(
    'chess_get_titled_players',
    {
      title: 'List titled players',
      description: 'Usernames of all players holding a given title (e.g. GM, IM, FM, WGM, NM).',
      inputSchema: { title: z.enum(['GM', 'WGM', 'IM', 'WIM', 'FM', 'WFM', 'NM', 'WNM', 'CM', 'WCM']) },
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
