import test from 'node:test';
import assert from 'node:assert/strict';

import { registerChessTools, summariseGame } from '../src/chess.js';
import { USER_AGENT, chessGet, clubId, username } from '../src/client.js';
import { REQUEST_TIMEOUT_MS, VERSION } from '../src/shared.js';

// Captures registerTool() calls. No network, no credentials — this server has
// no auth at all, so the whole surface is testable offline.
function collectTools() {
  const tools = new Map();
  registerChessTools({
    registerTool(name, config, handler) {
      tools.set(name, { name, config, handler });
    },
  });
  return tools;
}

/** Swap in a fake fetch for one call, always restoring the real one. */
async function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

const okResponse = (body = {}) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

test('registers all nine Chess.com tools', () => {
  assert.equal(collectTools().size, 9);
});

test('tool names are unique and namespaced with chess_', () => {
  const names = [...collectTools().keys()];
  assert.equal(new Set(names).size, names.length, 'duplicate tool name');
  for (const name of names) {
    assert.match(name, /^chess_[a-z0-9_]+$/, `"${name}" is not namespaced`);
  }
});

test('every tool declares a title, description and input schema', () => {
  for (const { name, config } of collectTools().values()) {
    assert.ok(config.title?.trim(), `${name} has no title`);
    assert.ok(config.description?.trim(), `${name} has no description`);
    assert.ok(config.inputSchema, `${name} has no inputSchema`);
  }
});

// Chess.com asks consumers to identify themselves; a generic agent gets
// throttled, so this header is not decorative.
test('requests identify themselves with a User-Agent and ask for JSON', async () => {
  let seen;
  await withFetch(async (url, init) => {
    seen = { url: String(url), init };
    return okResponse();
  }, () => chessGet('/player/hikaru'));

  assert.equal(seen.url, 'https://api.chess.com/pub/player/hikaru');
  assert.equal(seen.init.headers['User-Agent'], USER_AGENT);
  assert.match(USER_AGENT, new RegExp(`^chesscom-mcp/${VERSION.replace(/\./g, '\\.')} `));
  assert.equal(seen.init.headers.Accept, 'application/json');
});

test('a 404 becomes a readable "Not found" error naming the path', async () => {
  await withFetch(
    async () => ({ ok: false, status: 404, text: async () => 'not found' }),
    async () => {
      await assert.rejects(() => chessGet('/player/nobody'), /Not found: \/player\/nobody/);
    }
  );
});

test('other failures surface the status and the upstream body', async () => {
  await withFetch(
    async () => ({ ok: false, status: 503, text: async () => 'upstream down' }),
    async () => {
      await assert.rejects(() => chessGet('/leaderboards'), (err) => {
        assert.match(err.message, /503/);
        assert.match(err.message, /upstream down/);
        return true;
      });
    }
  );
});

test('a successful response is returned parsed, not as a Response', async () => {
  const body = { username: 'hikaru', title: 'GM' };
  const result = await withFetch(async () => okResponse(body), () =>
    chessGet('/player/hikaru')
  );
  assert.deepEqual(result, body);
});

// ---------------------------------------------------------------------------
// A real month of games: one titled player's September 2026 archive is 509
// games and 2.27 MB as the API sends it, almost all of it move records.

function game(overrides = {}) {
  return {
    url: 'https://www.chess.com/game/live/1',
    pgn: '[Event "Live Chess"]\n1. e4 c5 2. c3 Qa5 *'.repeat(40),
    tcn: 'mC0Kgv'.repeat(100),
    fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -',
    initial_setup: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    uuid: 'f78fcfe7-ab95-11f1-8ffd-6cfe54652c60',
    time_control: '300',
    time_class: 'blitz',
    end_time: 1788880073,
    rated: true,
    white: { rating: 2709, result: 'resigned', '@id': 'https://api.chess.com/pub/player/a', username: 'a', uuid: 'u1' },
    black: { rating: 3370, result: 'win', '@id': 'https://api.chess.com/pub/player/b', username: 'b', uuid: 'u2' },
    eco: 'https://www.chess.com/openings/Alapin-Sicilian-Defense',
    ...overrides,
  };
}

test('a game summary keeps players, ratings, results and links, and drops the moves', () => {
  const summary = summariseGame(game());
  for (const dropped of ['pgn', 'tcn', 'fen', 'initial_setup', 'uuid']) {
    assert.ok(!(dropped in summary), `${dropped} survived`);
  }
  assert.deepEqual(summary.white, { rating: 2709, result: 'resigned', username: 'a' });
  assert.deepEqual(summary.black, { rating: 3370, result: 'win', username: 'b' });
  assert.equal(summary.url, 'https://www.chess.com/game/live/1');
  assert.equal(summary.eco, 'https://www.chess.com/openings/Alapin-Sicilian-Defense');
});

test('chess_get_games_by_month summarises by default, filters by time class, and returns PGN on request', async () => {
  const { handler } = collectTools().get('chess_get_games_by_month');
  const archive = { games: [game(), game({ time_class: 'bullet', url: 'https://www.chess.com/game/live/2' })] };
  let requested;
  const call = (args) =>
    withFetch(async (url) => {
      requested = String(url);
      return okResponse(archive);
    }, () => handler({ username: 'hikaru', year: 2026, month: 9, ...args }));

  const summary = JSON.parse((await call({})).content[0].text);
  assert.equal(requested, 'https://api.chess.com/pub/player/hikaru/games/2026/09');
  assert.equal(summary.games.length, 2);
  assert.ok(summary.games.every((g) => !('pgn' in g)), 'PGN returned without being asked for');

  const blitz = JSON.parse((await call({ timeClass: 'blitz' })).content[0].text);
  assert.deepEqual(blitz.games.map((g) => g.time_class), ['blitz']);

  const full = JSON.parse((await call({ includePgn: true })).content[0].text);
  assert.ok(full.games.every((g) => g.pgn), 'includePgn did not return PGN');
});

test('tool results are compact JSON, not indented', async () => {
  const { handler } = collectTools().get('chess_get_profile');
  const result = await withFetch(async () => okResponse({ username: 'hikaru', title: 'GM' }), () =>
    handler({ username: 'hikaru' })
  );
  assert.equal(result.content[0].text, '{"username":"hikaru","title":"GM"}');
});

// ---------------------------------------------------------------------------
// Path segments. encodeURIComponent leaves ".." alone, so an unchecked
// username could quietly answer a different question.

test('usernames and club ids are checked before they reach the path', () => {
  assert.equal(username('Hikaru'), 'Hikaru');
  assert.equal(username('magnus_carlsen-1'), 'magnus_carlsen-1');
  for (const bad of ['..', '../titled/GM', 'Magnus Carlsen', 'a/b', '']) {
    assert.throws(() => username(bad), /is not a Chess\.com username/, JSON.stringify(bad));
  }
  assert.equal(clubId('team-canada'), 'team-canada');
  for (const bad of ['..', 'Team Canada', 'a/b']) {
    assert.throws(() => clubId(bad), /is not a club URL id/, JSON.stringify(bad));
  }
});

test('tools reject a bad username without making a request', async () => {
  const { handler } = collectTools().get('chess_get_stats');
  await withFetch(
    async () => assert.fail('a request was made'),
    () => assert.rejects(() => handler({ username: '../leaderboards' }), /not a Chess\.com username/)
  );
});

// ---------------------------------------------------------------------------
// Failure modes.

test('a 429 says when to retry', async () => {
  await withFetch(
    async () => new Response('Too Many Requests', { status: 429, headers: { 'retry-after': '5' } }),
    () => assert.rejects(() => chessGet('/leaderboards'), /rate limit reached for \/leaderboards; retry after 5s/)
  );
});

test('every request carries a timeout, and a timeout reads as one', async () => {
  let signal;
  await withFetch(
    async (_url, init) => {
      signal = init.signal;
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    },
    () =>
      assert.rejects(
        () => chessGet('/leaderboards'),
        new RegExp(`Chess\\.com API did not respond within ${REQUEST_TIMEOUT_MS / 1000}s`)
      )
  );
  assert.ok(signal instanceof AbortSignal);
});
