import test from 'node:test';
import assert from 'node:assert/strict';

import { registerChessTools } from '../src/chess.js';
import { chessGet } from '../src/client.js';

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
  assert.match(seen.init.headers['User-Agent'], /chesscom-mcp/);
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
