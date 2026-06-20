import type {
  RpcEndpoint,
  EndpointHealth,
  LoadBalancerConfig,
  SelectionResult,
  SelectionStrategy,
} from './types';

const DEFAULT_MAX_FAILURES = 3;
const DEFAULT_STRATEGY: SelectionStrategy = 'round-robin';

/**
 * Manages a pool of RPC/Horizon endpoints and selects among them using a
 * configurable strategy (round-robin, weighted, or failover).
 *
 * All HTTP I/O is intentionally absent from this class; callers drive health
 * updates via {@link recordSuccess} and {@link recordFailure} so the balancer
 * stays fully synchronous and trivially testable.
 */
export class RpcLoadBalancer {
  private readonly endpoints: RpcEndpoint[];
  private readonly maxFailures: number;
  private readonly strategy: SelectionStrategy;
  private readonly health: Map<string, EndpointHealth>;
  private rrCursor: number;
  private readonly randomFn: () => number;

  constructor(config: LoadBalancerConfig, randomFn: () => number = Math.random) {
    if (config.endpoints.length === 0) {
      throw new Error('RpcLoadBalancer requires at least one endpoint.');
    }
    this.endpoints = config.endpoints;
    this.maxFailures = config.maxFailures ?? DEFAULT_MAX_FAILURES;
    this.strategy = config.strategy ?? DEFAULT_STRATEGY;
    this.rrCursor = 0;
    this.randomFn = randomFn;
    this.health = new Map();
    for (const ep of this.endpoints) {
      this.health.set(ep.url, {
        endpoint: ep,
        status: 'healthy',
        failureCount: 0,
        lastCheckedAt: Date.now(),
      });
    }
  }

  /** Returns all endpoints whose status is not `down`. */
  getHealthyEndpoints(): RpcEndpoint[] {
    return this.endpoints.filter((ep) => {
      const h = this.health.get(ep.url);
      return h !== undefined && h.status !== 'down';
    });
  }

  /**
   * Selects an endpoint using the configured strategy.
   * Returns `null` when every endpoint in the pool is `down`.
   */
  select(): SelectionResult | null {
    const pool = this.getHealthyEndpoints();
    if (pool.length === 0) return null;

    switch (this.strategy) {
      case 'weighted':  return this.selectWeighted(pool);
      case 'failover':  return this.selectFailover(pool);
      default:          return this.selectRoundRobin(pool);
    }
  }

  private selectRoundRobin(pool: RpcEndpoint[]): SelectionResult {
    const idx = this.rrCursor % pool.length;
    this.rrCursor++;
    return { endpoint: pool[idx], index: idx };
  }

  private selectWeighted(pool: RpcEndpoint[]): SelectionResult {
    const totalWeight = pool.reduce((sum, ep) => sum + (ep.weight ?? 1), 0);
    let remaining = this.randomFn() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      remaining -= pool[i].weight ?? 1;
      if (remaining <= 0) {
        return { endpoint: pool[i], index: i };
      }
    }
    const last = pool.length - 1;
    return { endpoint: pool[last], index: last };
  }

  private selectFailover(pool: RpcEndpoint[]): SelectionResult {
    const sorted = [...pool].sort((a, b) => {
      const hA = this.health.get(a.url)?.failureCount ?? 0;
      const hB = this.health.get(b.url)?.failureCount ?? 0;
      return hA - hB;
    });
    return { endpoint: sorted[0], index: 0 };
  }

  /** Records a successful call and clears any accumulated failure count. */
  recordSuccess(url: string, responseTimeMs?: number): void {
    const h = this.health.get(url);
    if (!h) return;
    h.failureCount = 0;
    h.status = 'healthy';
    h.lastCheckedAt = Date.now();
    if (responseTimeMs !== undefined) h.responseTimeMs = responseTimeMs;
  }

  /**
   * Records a failed call.  Marks the endpoint `degraded` until
   * {@link maxFailures} is reached, at which point it becomes `down`.
   */
  recordFailure(url: string): void {
    const h = this.health.get(url);
    if (!h) return;
    h.failureCount += 1;
    h.lastCheckedAt = Date.now();
    h.status = h.failureCount >= this.maxFailures ? 'down' : 'degraded';
  }

  /** Returns the current health snapshot for the given URL. */
  getEndpointHealth(url: string): EndpointHealth | undefined {
    return this.health.get(url);
  }

  /** Returns health snapshots for all registered endpoints. */
  getAllHealth(): EndpointHealth[] {
    return Array.from(this.health.values());
  }

  /** Resets a single endpoint to `healthy` with zero failures. */
  resetEndpoint(url: string): void {
    const h = this.health.get(url);
    if (!h) return;
    h.failureCount = 0;
    h.status = 'healthy';
    h.lastCheckedAt = Date.now();
    delete h.responseTimeMs;
  }

  /** Resets every endpoint to `healthy`. */
  resetAll(): void {
    for (const url of this.health.keys()) {
      this.resetEndpoint(url);
    }
  }

  /** Total number of registered endpoints (healthy + degraded + down). */
  get size(): number {
    return this.endpoints.length;
  }
}