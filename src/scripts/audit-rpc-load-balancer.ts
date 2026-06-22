import * as https from 'https';
import * as http from 'http';
import { HORIZON_BASE_URLS } from '../config/stellar.config';

interface AuditResult {
  endpoint: string;
  isSslValid: boolean;
  exposesSensitiveHeaders: boolean;
  corsPermissive: boolean;
  rateLimitResponsive: boolean;
}

function log(level: 'info' | 'warn' | 'error', msg: string): void {
  const prefix = { info: '[INFO]', warn: '[WARN]', error: '[ERROR]' }[level];
  console[level === 'info' ? 'log' : level](`${prefix} [RpcSecurityAudit] ${msg}`);
}

/** Performs a single HTTP(S) request and resolves with status + headers. */
function request(
  url: string,
  method: string,
  timeoutMs = 5000,
): Promise<{ status: number; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      { hostname: parsed.hostname, path: parsed.pathname, method, timeout: timeoutMs },
      (res) => resolve({ status: res.statusCode ?? 0, headers: res.headers as Record<string, string | string[] | undefined> }),
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

async function auditEndpoint(network: string, url: string): Promise<AuditResult> {
  log('info', `Auditing [${network}] → ${url}`);

  const result: AuditResult = {
    endpoint: url,
    isSslValid: url.startsWith('https://'),
    exposesSensitiveHeaders: false,
    corsPermissive: false,
    rateLimitResponsive: false,
  };

  try {
    // 1. Check CORS and server header exposure
    const { headers } = await request(url, 'OPTIONS');

    if (headers['access-control-allow-origin'] === '*') {
      result.corsPermissive = true;
      log('warn', `Permissive CORS '*' on [${network}]`);
    }

    if (headers['server']) {
      result.exposesSensitiveHeaders = true;
      log('warn', `Server header exposed on [${network}]: ${headers['server']}`);
    }

    // 2. Burst test for rate-limit enforcement
    log('info', `Burst-testing rate limiting on [${network}]...`);
    const burstResponses = await Promise.all(
      Array.from({ length: 20 }, () => request(`${url}/fee_stats`, 'GET', 3000)),
    );

    result.rateLimitResponsive = burstResponses.some((r) => r.status === 429);
    if (!result.rateLimitResponsive) {
      log('warn', `No 429 response during burst on [${network}] — possible DoS exposure`);
    }
  } catch (err) {
    log('error', `Audit fault on [${network}]: ${(err as Error).message}`);
  }

  return result;
}

async function runRpcSecurityAudit(): Promise<void> {
  log('info', 'Starting RPC load-balancer security audit...');

  const reports = await Promise.all(
    Object.entries(HORIZON_BASE_URLS).map(([network, url]) => auditEndpoint(network, url)),
  );

  console.table(reports);
  log('info', 'Audit complete.');
}

runRpcSecurityAudit().catch((err) => {
  console.error('Audit aborted:', err);
  process.exit(1);
});
