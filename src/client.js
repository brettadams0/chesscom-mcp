const BASE_URL = 'https://api.chess.com/pub';

// Chess.com asks all API consumers to identify themselves with a real
// User-Agent (app name + contact) rather than a generic client string.
const USER_AGENT = 'chesscom-mcp/1.0 (personal use; contact: adamsbrett00@gmail.com)';

export async function chessGet(pathname) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (res.status === 404) {
    throw new Error(`Not found: ${pathname}`);
  }
  if (!res.ok) {
    throw new Error(`Chess.com API error ${res.status} for ${pathname}: ${await res.text()}`);
  }
  return res.json();
}
