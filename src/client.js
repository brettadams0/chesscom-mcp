import { VERSION, fetchWithTimeout, responseError } from './shared.js';

const BASE_URL = 'https://api.chess.com/pub';

// Chess.com asks all API consumers to identify themselves with a real
// User-Agent (app name + contact) rather than a generic client string.
export const USER_AGENT = `chesscom-mcp/${VERSION} (personal use; contact: adamsbrett00@gmail.com)`;

export async function chessGet(pathname) {
  const res = await fetchWithTimeout(
    `${BASE_URL}${pathname}`,
    { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
    'Chess.com API'
  );
  if (res.status === 404) {
    throw new Error(`Not found: ${pathname}`);
  }
  if (!res.ok) throw await responseError(res, 'Chess.com API', pathname);
  return res.json();
}

/**
 * Validate a username for use in a URL path. Usernames go straight into the
 * path, and encodeURIComponent leaves ".." alone, so "../titled/GM" would
 * quietly answer a different question. Checking the shape also turns a display
 * name with a space in it into a clear error rather than a 404.
 */
export function username(name) {
  if (!/^[A-Za-z0-9_-]{1,25}$/.test(name)) {
    throw new Error(`"${name}" is not a Chess.com username (letters, digits, "_" and "-"; not the display name).`);
  }
  return name;
}

/** Validate a club URL id: the lowercase, hyphenated slug from chess.com/club/<url-id>. */
export function clubId(urlId) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(urlId)) {
    throw new Error(`"${urlId}" is not a club URL id; use the slug from chess.com/club/<url-id>, e.g. "team-canada".`);
  }
  return urlId;
}
