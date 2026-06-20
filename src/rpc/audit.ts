import type { AuditResult, AuditReport } from './types';

/**
 * HTTP response headers as a plain object.
 * Values may be a single string, an array of strings, or absent.
 */
export type ResponseHeaders = Record<string, string | string[] | undefined>;

/**
 * Returns `true` when the URL uses the HTTPS scheme.
 * Invalid URLs always return `false`.
 */
export function evaluateSslSecurity(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Returns `true` when the CORS `Access-Control-Allow-Origin` header is the
 * wildcard `*`, indicating an overly permissive cross-origin policy.
 */
export function evaluateCorsPolicy(headers: ResponseHeaders): boolean {
  const origin = headers['access-control-allow-origin'];
  return typeof origin === 'string' && origin === '*';
}

/**
 * Returns `true` when the response leaks server infrastructure details via
 * headers such as `Server`, `X-Powered-By`, or `X-AspNet-Version`.
 */
export function evaluateSensitiveHeaders(headers: ResponseHeaders): boolean {
  const leaky = ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version'];
  return leaky.some((name) => {
    const val = headers[name];
    return typeof val === 'string' && val.length > 0;
  });
}

/**
 * Returns `true` when the sampled set of HTTP status codes includes a 429,
 * confirming that the endpoint enforces rate limiting under burst load.
 */
export function evaluateRateLimiting(statusCodes: number[]): boolean {
  return statusCodes.includes(429);
}

/**
 * Collects human-readable warning messages from the four audit signals.
 * Returns an empty array for a fully compliant endpoint.
 */
export function collectWarnings(
  url: string,
  isSslValid: boolean,
  corsPermissive: boolean,
  exposesSensitiveHeaders: boolean,
  rateLimitPresent: boolean,
): string[] {
  const warnings: string[] = [];
  if (!isSslValid) {
    warnings.push(`[SSL] Endpoint uses a non-HTTPS scheme: ${url}`);
  }
  if (corsPermissive) {
    warnings.push(`[CORS] Permissive wildcard CORS policy detected on ${url}`);
  }
  if (exposesSensitiveHeaders) {
    warnings.push(`[INFO-LEAK] Server-identifying headers are exposed on ${url}`);
  }
  if (!rateLimitPresent) {
    warnings.push(`[DOS] No rate-limit (HTTP 429) observed on ${url}; endpoint may be vulnerable to burst attacks`);
  }
  return warnings;
}

/**
 * Builds a single {@link AuditResult} from pre-fetched probe data.
 *
 * All HTTP I/O is delegated to the caller so this function remains pure and
 * straightforward to unit-test without network access.
 */
export function buildAuditResult(
  network: string,
  url: string,
  headers: ResponseHeaders,
  probedStatusCodes: number[],
): AuditResult {
  const isSslValid = evaluateSslSecurity(url);
  const corsPermissive = evaluateCorsPolicy(headers);
  const exposesSensitiveHeaders = evaluateSensitiveHeaders(headers);
  const rateLimitPresent = evaluateRateLimiting(probedStatusCodes);

  return {
    endpoint: url,
    network,
    isSslValid,
    corsPermissive,
    exposesSensitiveHeaders,
    rateLimitPresent,
    warnings: collectWarnings(url, isSslValid, corsPermissive, exposesSensitiveHeaders, rateLimitPresent),
  };
}

/**
 * Aggregates a list of {@link AuditResult}s into a summary {@link AuditReport}.
 * A result is counted as a pass only when its `warnings` array is empty.
 */
export function compileAuditReport(results: AuditResult[]): AuditReport {
  const warnCount = results.reduce((n, r) => n + r.warnings.length, 0);
  const passCount = results.filter((r) => r.warnings.length === 0).length;
  return {
    auditedAt: new Date().toISOString(),
    totalEndpoints: results.length,
    passCount,
    warnCount,
    results,
  };
}

/** Returns `true` when the audit result has no warnings. */
export function isCleanResult(result: AuditResult): boolean {
  return result.warnings.length === 0;
}