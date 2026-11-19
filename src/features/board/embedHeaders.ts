/** Response headers for a website shown in a board frame. Pure, so it is unit tested. */

type Headers = Record<string, string[]>;

/** Drops X-Frame-Options and the `frame-ancestors` rule of any CSP; everything else is kept as is. */
export function allowFraming(headers: Headers): Headers {
  const result: Headers = {};
  for (const [name, values] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (lower === 'x-frame-options') continue;
    if (lower === 'content-security-policy') {
      const kept = values
        .map((policy) => policy.split(';').filter((rule) => !/^\s*frame-ancestors\b/i.test(rule)).join(';').trim())
        .filter((policy) => policy !== '');
      if (kept.length > 0) result[name] = kept;
      continue;
    }
    result[name] = values;
  }
  return result;
}
