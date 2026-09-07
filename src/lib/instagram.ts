// Handle-only Instagram enrichment — pure, testable helpers plus one network fetch.
//
// SAFE by design: we NEVER scrape instagram.com and we NEVER call an LLM. The only
// network request we make is to the business's OWN website (lead.website), whose footer
// or header almost always links to its Instagram profile. If the website itself already
// is an instagram.com URL, we read the handle straight from it — no request at all.

// Instagram paths that are NOT profile handles. A link to any of these must be ignored.
const RESERVED_HANDLES = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "stories",
  "explore",
  "accounts",
  "about",
  "developer",
  "developers",
  "directory",
  "legal",
  "privacy",
  "terms",
  "help",
  "web",
  "sharer",
  "share",
  "embed",
  "login",
  "emails",
  "session",
]);

// Instagram usernames: letters, numbers, dots and underscores, up to 30 chars.
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

// Strip @, whitespace, surrounding slashes and lowercase. Returns null if what remains
// isn't a plausible Instagram username.
export function normalizeHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let handle = raw.trim();
  if (!handle) return null;
  // Drop a leading @, then any surrounding slashes.
  handle = handle.replace(/^@+/, "").replace(/^\/+/, "").replace(/\/+$/, "");
  // Keep only the first path segment if something slipped through (e.g. "user/tagged").
  handle = handle.split(/[/?#]/)[0];
  handle = handle.toLowerCase();
  if (!HANDLE_RE.test(handle)) return null;
  if (RESERVED_HANDLES.has(handle)) return null;
  return handle;
}

// Build the canonical public profile URL for a handle.
export function buildInstagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle}`;
}

// Given any URL or string, return the normalized Instagram handle if it points to an
// instagram.com profile, otherwise null. Ignores post/reel/explore/accounts paths.
export function extractInstagramHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;

  // Accept bare "instagram.com/..." and "@handle" forms too.
  let parsed: URL | null = null;
  try {
    parsed = new URL(raw);
  } catch {
    try {
      parsed = new URL(`https://${raw.replace(/^\/+/, "")}`);
    } catch {
      parsed = null;
    }
  }

  if (parsed) {
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "instagram.com" && !host.endsWith(".instagram.com")) return null;
    const firstSegment = parsed.pathname.split("/").filter(Boolean)[0];
    return normalizeHandle(firstSegment ?? null);
  }

  // Not a URL — maybe a bare "@handle".
  if (raw.startsWith("@")) return normalizeHandle(raw);
  return null;
}

// Scan arbitrary page HTML for the first instagram.com profile link and return its
// handle. Reuses extractInstagramHandle so reserved paths are skipped automatically.
export function findInstagramInHtml(html: string): string | null {
  if (!html) return null;
  // Match instagram.com URLs (with or without scheme / www), stopping at the first
  // character that can't be part of a URL (quotes, whitespace, angle brackets, etc.).
  const re = /(?:https?:)?\/\/(?:[a-z0-9-]+\.)?instagram\.com\/[^\s"'<>)\\]+/gi;
  for (const match of html.matchAll(re)) {
    const handle = extractInstagramHandle(match[0]);
    if (handle) return handle;
  }
  return null;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 500 * 1024; // ~500KB cap on the HTML we read.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Resolve an Instagram handle from a business website. Never throws — returns null on
// any error (bad URL, timeout, non-HTML, network failure, nothing found).
export async function fetchInstagramHandleFromWebsite(
  website: string | null | undefined
): Promise<{ handle: string; method: "website_url" | "website_html" } | null> {
  if (!website) return null;

  // Case 1: the website field itself is an Instagram profile URL — no request needed.
  const direct = extractInstagramHandle(website);
  if (direct) return { handle: direct, method: "website_url" };

  // Normalize to an absolute http(s) URL before fetching.
  let target: URL;
  try {
    target = new URL(website.trim());
  } catch {
    try {
      target = new URL(`https://${website.trim().replace(/^\/+/, "")}`);
    } catch {
      return null;
    }
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok || !res.body) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return null;

    // Read the body in chunks, capping at MAX_BODY_BYTES so a huge page can't blow up.
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let html = "";
    let received = 0;
    while (received < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      const early = findInstagramInHtml(html);
      if (early) {
        await reader.cancel().catch(() => {});
        return { handle: early, method: "website_html" };
      }
    }
    await reader.cancel().catch(() => {});
    html += decoder.decode();

    const handle = findInstagramInHtml(html);
    if (handle) return { handle, method: "website_html" };
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
