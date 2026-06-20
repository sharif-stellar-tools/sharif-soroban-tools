import { RpcLoadBalancer } from '../../src/rpc/load-balancer';
import type { RpcEndpoint, LoadBalancerConfig } from '../../src/rpc/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ep = (url: string, network = 'testnet', weight?: number): RpcEndpoint => ({
  url,
  network,
  ...(weight !== undefined ? { weight } : {}),
});

const pool: RpcEndpoint[] = [
  ep('https://horizon.stellar.org',            'mainnet'),
  ep('https://horizon-testnet.stellar.org',    'testnet'),
  ep('https://horizon-futurenet.stellar.org',  'futurenet'),
];

function make(overrides: Partial<LoadBalancerConfig> = {}, randomFn?: () => number) {
  return new RpcLoadBalancer({ endpoints: pool, ...overrides }, randomFn);
}

// ─── Constructor ──────────────────────────────────────────────────────────────
describe('RpcLoadBalancer — constructor', () => {
  it('reports the correct pool size', () => {
    expect(make().size).toBe(3);
  });

  it('marks every endpoint healthy on initialisation', () => {
    make().getAllHealth().forEach((h) => {
      expect(h.status).toBe('healthy');
      expect(h.failureCount).toBe(0);
    });
  });

  it('throws when given an empty endpoint list', () => {
    expect(() => new RpcLoadBalancer({ endpoints: [] })).toThrow(
      'RpcLoadBalancer requires at least one endpoint.',
    );
  });

  it('stores endpoint metadata verbatim', () => {
    const lb = make();
    const health = lb.getEndpointHealth(pool[0].url);
    expect(health?.endpoint.network).toBe('mainnet');
  });
});

// ─── Round-robin ──────────────────────────────────────────────────────────────
describe('RpcLoadBalancer — round-robin', () => {
  it('cycles through all endpoints deterministically', () => {
    const lb = make({ strategy: 'round-robin' });
    const urls = Array.from({ length: 9 }, () => lb.select()?.endpoint.url);
    const cycle = pool.map((e) => e.url);
    expect(urls).toEqual([...cycle, ...cycle, ...cycle]);
  });

  it('wraps back to the first endpoint after exhausting the pool', () => {
    const lb = make({ strategy: 'round-robin' });
    const first = lb.select()?.endpoint.url;
    lb.select();
    lb.select();
    expect(lb.select()?.endpoint.url).toBe(first);
  });

  it('returns null when all endpoints are down', () => {
    const lb = make({ strategy: 'round-robin', maxFailures: 1 });
    pool.forEach((e) => lb.recordFailure(e.url));
    expect(lb.select()).toBeNull();
  });

  it('skips down endpoints and distributes among remaining healthy ones', () => {
    const lb = make({ strategy: 'round-robin', maxFailures: 1 });
    lb.recordFailure(pool[0].url);
    const urls = Array.from({ length: 6 }, () => lb.select()?.endpoint.url);
    expect(urls).not.toContain(pool[0].url);
    expect(urls).toContain(pool[1].url);
    expect(urls).toContain(pool[2].url);
  });

  it('includes a degraded endpoint (below maxFailures) in selections', () => {
    const lb = make({ strategy: 'round-robin', maxFailures: 3 });
    lb.recordFailure(pool[0].url); // degraded, not down
    const urls = new Set(Array.from({ length: 9 }, () => lb.select()?.endpoint.url));
    expect(urls.has(pool[0].url)).toBe(true);
  });
});

// ─── Weighted ─────────────────────────────────────────────────────────────────
describe('RpcLoadBalancer — weighted', () => {
  const weighted = [
    ep('https://a.test', 'testnet', 4),
    ep('https://b.test', 'testnet', 1),
  ];

  it('selects the first bucket when random value is near zero', () => {
    const lb = new RpcLoadBalancer({ endpoints: weighted, strategy: 'weighted' }, () => 0);
    expect(lb.select()?.endpoint.url).toBe('https://a.test');
  });

  it('selects the last bucket when random value is near one', () => {
    const lb = new RpcLoadBalancer({ endpoints: weighted, strategy: 'weighted' }, () => 0.9999);
    expect(lb.select()?.endpoint.url).toBe('https://b.test');
  });

  it('defaults missing weight to 1 for equal distribution', () => {
    const equal = [ep('https://x.test'), ep('https://y.test')];
    const lb = new RpcLoadBalancer({ endpoints: equal, strategy: 'weighted' }, () => 0);
    expect(lb.select()?.endpoint.url).toBe('https://x.test');
  });

  it('returns null when all weighted endpoints are down', () => {
    const lb = new RpcLoadBalancer(
      { endpoints: weighted, strategy: 'weighted', maxFailures: 1 },
      () => 0,
    );
    weighted.forEach((e) => lb.recordFailure(e.url));
    expect(lb.select()).toBeNull();
  });
});

// ─── Failover ─────────────────────────────────────────────────────────────────
describe('RpcLoadBalancer — failover', () => {
  it('prefers the endpoint with the fewest failures', () => {
    const lb = make({ strategy: 'failover', maxFailures: 10 });
    lb.recordFailure(pool[0].url);
    lb.recordFailure(pool[0].url); // pool[0] has 2 failures
    const result = lb.select();
    expect(result?.endpoint.url).not.toBe(pool[0].url);
  });

  it('falls back to next healthiest after primary goes down', () => {
    const lb = make({ strategy: 'failover', maxFailures: 2 });
    lb.recordFailure(pool[0].url);
    lb.recordFailure(pool[0].url); // pool[0] is now down
    const urls = new Set(Array.from({ length: 4 }, () => lb.select()?.endpoint.url));
    expect(urls.has(pool[0].url)).toBe(false);
  });

  it('returns null when all failover candidates are exhausted', () => {
    const lb = make({ strategy: 'failover', maxFailures: 1 });
    pool.forEach((e) => lb.recordFailure(e.url));
    expect(lb.select()).toBeNull();
  });

  it('recovers after a previously-down endpoint is reset', () => {
    const lb = make({ strategy: 'failover', maxFailures: 1 });
    lb.recordFailure(pool[0].url); // down
    lb.recordFailure(pool[1].url); // down
    lb.recordFailure(pool[2].url); // down
    lb.resetEndpoint(pool[0].url);
    expect(lb.select()?.endpoint.url).toBe(pool[0].url);
  });
});

// ─── Health tracking ──────────────────────────────────────────────────────────
describe('RpcLoadBalancer — health tracking', () => {
  it('increments failure count on each recordFailure call', () => {
    const lb = make({ maxFailures: 5 });
    lb.recordFailure(pool[0].url);
    lb.recordFailure(pool[0].url);
    expect(lb.getEndpointHealth(pool[0].url)?.failureCount).toBe(2);
  });

  it('transitions to degraded before reaching maxFailures', () => {
    const lb = make({ maxFailures: 3 });
    lb.recordFailure(pool[0].url);
    expect(lb.getEndpointHealth(pool[0].url)?.status).toBe('degraded');
  });

  it('transitions to down exactly at maxFailures', () => {
    const lb = make({ maxFailures: 3 });
    lb.recordFailure(pool[0].url);
    lb.recordFailure(pool[0].url);
    lb.recordFailure(pool[0].url);
    expect(lb.getEndpointHealth(pool[0].url)?.status).toBe('down');
  });

  it('recordSuccess clears failures and restores healthy status', () => {
    const lb = make({ maxFailures: 3 });
    lb.recordFailure(pool[0].url);
    lb.recordFailure(pool[0].url);
    lb.recordSuccess(pool[0].url);
    const h = lb.getEndpointHealth(pool[0].url);
    expect(h?.failureCount).toBe(0);
    expect(h?.status).toBe('healthy');
  });

  it('recordSuccess stores the optional response time', () => {
    const lb = make();
    lb.recordSuccess(pool[0].url, 55);
    expect(lb.getEndpointHealth(pool[0].url)?.responseTimeMs).toBe(55);
  });

  it('recordFailure on an unknown URL does not throw', () => {
    expect(() => make().recordFailure('https://unknown.example')).not.toThrow();
  });

  it('recordSuccess on an unknown URL does not throw', () => {
    expect(() => make().recordSuccess('https://unknown.example')).not.toThrow();
  });

  it('getEndpointHealth returns undefined for an unregistered URL', () => {
    expect(make().getEndpointHealth('https://not-registered.example')).toBeUndefined();
  });

  it('getAllHealth returns one snapshot per registered endpoint', () => {
    expect(make().getAllHealth()).toHaveLength(3);
  });
});

// ─── Reset behaviour ──────────────────────────────────────────────────────────
describe('RpcLoadBalancer — reset', () => {
  it('resetEndpoint clears failures and restores healthy status', () => {
    const lb = make({ maxFailures: 2 });
    lb.recordFailure(pool[0].url);
    lb.recordFailure(pool[0].url);
    lb.resetEndpoint(pool[0].url);
    const h = lb.getEndpointHealth(pool[0].url);
    expect(h?.status).toBe('healthy');
    expect(h?.failureCount).toBe(0);
  });

  it('resetEndpoint removes a previously stored response time', () => {
    const lb = make();
    lb.recordSuccess(pool[0].url, 88);
    lb.resetEndpoint(pool[0].url);
    expect(lb.getEndpointHealth(pool[0].url)?.responseTimeMs).toBeUndefined();
  });

  it('resetEndpoint on an unknown URL does not throw', () => {
    expect(() => make().resetEndpoint('https://unknown.example')).not.toThrow();
  });

  it('resetAll restores every endpoint to healthy', () => {
    const lb = make({ maxFailures: 1 });
    pool.forEach((e) => lb.recordFailure(e.url));
    lb.resetAll();
    lb.getAllHealth().forEach((h) => {
      expect(h.status).toBe('healthy');
      expect(h.failureCount).toBe(0);
    });
  });

  it('select works normally after resetAll on a fully-down pool', () => {
    const lb = make({ maxFailures: 1 });
    pool.forEach((e) => lb.recordFailure(e.url));
    expect(lb.select()).toBeNull();
    lb.resetAll();
    expect(lb.select()).not.toBeNull();
  });
});