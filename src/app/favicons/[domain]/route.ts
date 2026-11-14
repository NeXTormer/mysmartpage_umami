// NUMI build: referrer/website favicons are served from this instance, so the
// browser never contacts a third party. The server fetches the icon once from
// DuckDuckGo's icon service and caches it in memory; unknown domains get a
// neutral globe icon.
const UPSTREAM_URL = 'https://icons.duckduckgo.com/ip3/{{domain}}.ico';
const DOMAIN_PATTERN =
  /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const MAX_ENTRIES = 1000;
const MAX_BYTES = 100 * 1024;
const FETCH_TIMEOUT_MS = 3000;
const ICON_MAX_AGE = 7 * 24 * 60 * 60;
const FALLBACK_MAX_AGE = 24 * 60 * 60;

const FALLBACK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#5b6579" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;

type CachedIcon = { body: ArrayBuffer; contentType: string } | null;

const cache = new Map<string, CachedIcon>();

function remember(domain: string, icon: CachedIcon) {
  if (cache.size >= MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(domain, icon);
}

async function fetchIcon(domain: string): Promise<CachedIcon> {
  try {
    const res = await fetch(UPSTREAM_URL.replace('{{domain}}', domain), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok || !contentType.startsWith('image/')) {
      return null;
    }

    const body = await res.arrayBuffer();

    return body.byteLength > 0 && body.byteLength <= MAX_BYTES ? { body, contentType } : null;
  } catch {
    return null;
  }
}

function fallback() {
  return new Response(FALLBACK_ICON, {
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': `public, max-age=${FALLBACK_MAX_AGE}`,
    },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ domain: string }> }) {
  const domain = decodeURIComponent((await params).domain)
    .toLowerCase()
    .replace(/\.ico$/, '');

  if (!DOMAIN_PATTERN.test(domain)) {
    return fallback();
  }

  let icon = cache.get(domain);

  if (icon === undefined) {
    icon = await fetchIcon(domain);
    remember(domain, icon);
  }

  if (!icon) {
    return fallback();
  }

  return new Response(icon.body, {
    headers: {
      'content-type': icon.contentType,
      'cache-control': `public, max-age=${ICON_MAX_AGE}`,
      'x-content-type-options': 'nosniff',
    },
  });
}
