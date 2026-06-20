import {
  evaluateSslSecurity,
  evaluateCorsPolicy,
  evaluateSensitiveHeaders,
  evaluateRateLimiting,
  collectWarnings,
  buildAuditResult,
  compileAuditReport,
  isCleanResult,
} from '../../src/rpc/audit';
import type { ResponseHeaders } from '../../src/rpc/audit';
import type { AuditResult } from '../../src/rpc/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CLEAN_HEADERS: ResponseHeaders = { 'content-type': 'application/hal+json' };
const RATE_LIMITED = [200, 200, 429, 200];
const NO_RATE_LIMIT = [200, 200, 200, 200];

function makeResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    endpoint: 'https://horizon.stellar.org',
    network: 'mainnet',
    isSslValid: true,
    corsPermissive: false,
    exposesSensitiveHeaders: false,
    rateLimitPresent: true,
    warnings: [],
    ...overrides,
  };
}

// ─── evaluateSslSecurity ──────────────────────────────────────────────────────
describe('evaluateSslSecurity', () => {
  it('returns true for a standard HTTPS URL', () => {
    expect(evaluateSslSecurity('https://horizon.stellar.org')).toBe(true);
  });

  it('returns false for a plain HTTP URL', () => {
    expect(evaluateSslSecurity('http://insecure.example.com')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(evaluateSslSecurity('')).toBe(false);
  });

  it('returns false for a malformed URL', () => {
    expect(evaluateSslSecurity('not-a-url')).toBe(false);
  });

  it('returns true for HTTPS with a custom port', () => {
    expect(evaluateSslSecurity('https://rpc.example.com:8443/api')).toBe(true);
  });

  it('returns false for an HTTP URL with a path', () => {
    expect(evaluateSslSecurity('http://example.com/horizon')).toBe(false);
  });
});

// ─── evaluateCorsPolicy ───────────────────────────────────────────────────────
describe('evaluateCorsPolicy', () => {
  it('returns true when Access-Control-Allow-Origin is wildcard', () => {
    expect(evaluateCorsPolicy({ 'access-control-allow-origin': '*' })).toBe(true);
  });

  it('returns false when Access-Control-Allow-Origin is a specific origin', () => {
    expect(evaluateCorsPolicy({ 'access-control-allow-origin': 'https://app.example.com' })).toBe(false);
  });

  it('returns false when the CORS header is absent', () => {
    expect(evaluateCorsPolicy(CLEAN_HEADERS)).toBe(false);
  });

  it('returns false when the value is undefined', () => {
    expect(evaluateCorsPolicy({ 'access-control-allow-origin': undefined })).toBe(false);
  });

  it('returns false when the value is an array (non-string)', () => {
    expect(evaluateCorsPolicy({ 'access-control-allow-origin': ['*', 'https://safe.example'] })).toBe(false);
  });
});

// ─── evaluateSensitiveHeaders ─────────────────────────────────────────────────
describe('evaluateSensitiveHeaders', () => {
  it('returns true when the Server header is present', () => {
    expect(evaluateSensitiveHeaders({ server: 'nginx/1.24.0' })).toBe(true);
  });

  it('returns true when X-Powered-By is present', () => {
    expect(evaluateSensitiveHeaders({ 'x-powered-by': 'Express' })).toBe(true);
  });

  it('returns true when X-AspNet-Version is present', () => {
    expect(evaluateSensitiveHeaders({ 'x-aspnet-version': '4.0.30319' })).toBe(true);
  });

  it('returns true when X-AspNetMvc-Version is present', () => {
    expect(evaluateSensitiveHeaders({ 'x-aspnetmvc-version': '5.2' })).toBe(true);
  });

  it('returns false when only safe headers are present', () => {
    expect(evaluateSensitiveHeaders({ 'content-type': 'application/json', 'cache-control': 'no-store' })).toBe(false);
  });

  it('returns false for an empty header map', () => {
    expect(evaluateSensitiveHeaders({})).toBe(false);
  });
});

// ─── evaluateRateLimiting ─────────────────────────────────────────────────────
describe('evaluateRateLimiting', () => {
  it('returns true when 429 appears among the sampled codes', () => {
    expect(evaluateRateLimiting(RATE_LIMITED)).toBe(true);
  });

  it('returns false when no 429 appears', () => {
    expect(evaluateRateLimiting(NO_RATE_LIMIT)).toBe(false);
  });

  it('returns false for an empty status-code array', () => {
    expect(evaluateRateLimiting([])).toBe(false);
  });

  it('returns true for a list containing only 429', () => {
    expect(evaluateRateLimiting([429])).toBe(true);
  });

  it('returns false when similar codes (like 403) are present but not 429', () => {
    expect(evaluateRateLimiting([200, 403, 401])).toBe(false);
  });
});

// ─── collectWarnings ──────────────────────────────────────────────────────────
describe('collectWarnings', () => {
  it('returns no warnings for a fully compliant endpoint', () => {
    expect(collectWarnings('https://ok.example', true, false, false, true)).toHaveLength(0);
  });

  it('emits an SSL warning for non-HTTPS endpoints', () => {
    const w = collectWarnings('http://bad.example', false, false, false, true);
    expect(w.some((m) => m.includes('[SSL]'))).toBe(true);
  });

  it('emits a CORS warning for a wildcard policy', () => {
    const w = collectWarnings('https://ok.example', true, true, false, true);
    expect(w.some((m) => m.includes('[CORS]'))).toBe(true);
  });

  it('emits an info-leak warning when sensitive headers are present', () => {
    const w = collectWarnings('https://ok.example', true, false, true, true);
    expect(w.some((m) => m.includes('[INFO-LEAK]'))).toBe(true);
  });

  it('emits a DoS warning when no rate limiting is detected', () => {
    const w = collectWarnings('https://ok.example', true, false, false, false);
    expect(w.some((m) => m.includes('[DOS]'))).toBe(true);
  });

  it('returns all four warnings for a worst-case endpoint', () => {
    const w = collectWarnings('http://worst.example', false, true, true, false);
    expect(w).toHaveLength(4);
  });

  it('warning messages include the endpoint URL', () => {
    const url = 'http://traceable.example';
    const w = collectWarnings(url, false, false, false, false);
    expect(w.every((m) => m.includes(url))).toBe(true);
  });
});

// ─── buildAuditResult ────────────────────────────────────────────────────────
describe('buildAuditResult', () => {
  it('builds a fully passing result for a well-configured endpoint', () => {
    const result = buildAuditResult('mainnet', 'https://horizon.stellar.org', CLEAN_HEADERS, RATE_LIMITED);
    expect(result.isSslValid).toBe(true);
    expect(result.corsPermissive).toBe(false);
    expect(result.exposesSensitiveHeaders).toBe(false);
    expect(result.rateLimitPresent).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('flags all four issues for a non-compliant endpoint', () => {
    const result = buildAuditResult(
      'testnet',
      'http://insecure.example',
      { 'access-control-allow-origin': '*', server: 'Apache/2.4' },
      NO_RATE_LIMIT,
    );
    expect(result.isSslValid).toBe(false);
    expect(result.corsPermissive).toBe(true);
    expect(result.exposesSensitiveHeaders).toBe(true);
    expect(result.rateLimitPresent).toBe(false);
    expect(result.warnings).toHaveLength(4);
  });

  it('attaches the correct network and endpoint URL', () => {
    const result = buildAuditResult('futurenet', 'https://rpc.futurenet.example', {}, RATE_LIMITED);
    expect(result.network).toBe('futurenet');
    expect(result.endpoint).toBe('https://rpc.futurenet.example');
  });

  it('detects only the CORS issue when everything else is clean', () => {
    const result = buildAuditResult(
      'testnet',
      'https://cors.example',
      { 'access-control-allow-origin': '*' },
      RATE_LIMITED,
    );
    expect(result.corsPermissive).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('[CORS]');
  });
});

// ─── compileAuditReport ───────────────────────────────────────────────────────
describe('compileAuditReport', () => {
  it('counts total endpoints correctly', () => {
    const report = compileAuditReport([makeResult(), makeResult(), makeResult()]);
    expect(report.totalEndpoints).toBe(3);
  });

  it('counts endpoints with zero warnings as passes', () => {
    const results = [
      makeResult({ warnings: [] }),
      makeResult({ warnings: ['[SSL] bad'] }),
      makeResult({ warnings: [] }),
    ];
    expect(compileAuditReport(results).passCount).toBe(2);
  });

  it('sums warning counts across all results', () => {
    const results = [
      makeResult({ warnings: ['w1', 'w2'] }),
      makeResult({ warnings: ['w3'] }),
      makeResult({ warnings: [] }),
    ];
    expect(compileAuditReport(results).warnCount).toBe(3);
  });

  it('produces a valid ISO-8601 auditedAt timestamp', () => {
    const report = compileAuditReport([makeResult()]);
    expect(report.auditedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(() => new Date(report.auditedAt)).not.toThrow();
  });

  it('handles an empty results array gracefully', () => {
    const report = compileAuditReport([]);
    expect(report.totalEndpoints).toBe(0);
    expect(report.passCount).toBe(0);
    expect(report.warnCount).toBe(0);
  });

  it('preserves all result entries in the report', () => {
    const r1 = makeResult({ network: 'mainnet' });
    const r2 = makeResult({ network: 'testnet' });
    const report = compileAuditReport([r1, r2]);
    expect(report.results).toHaveLength(2);
    expect(report.results[0].network).toBe('mainnet');
    expect(report.results[1].network).toBe('testnet');
  });
});

// ─── isCleanResult ────────────────────────────────────────────────────────────
describe('isCleanResult', () => {
  it('returns true for a result with no warnings', () => {
    expect(isCleanResult(makeResult({ warnings: [] }))).toBe(true);
  });

  it('returns false for a result with one or more warnings', () => {
    expect(isCleanResult(makeResult({ warnings: ['[SSL] issue'] }))).toBe(false);
  });

  it('returns false for a result with multiple warnings', () => {
    expect(isCleanResult(makeResult({ warnings: ['[SSL]', '[CORS]', '[DOS]'] }))).toBe(false);
  });
});