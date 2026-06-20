/** Operational status of a single RPC/Horizon endpoint. */
export type EndpointStatus = 'healthy' | 'degraded' | 'down';

/** Strategy applied when selecting an endpoint from the pool. */
export type SelectionStrategy = 'round-robin' | 'weighted' | 'failover';

/** Descriptor for one RPC/Horizon endpoint. */
export interface RpcEndpoint {
  /** Full URL, e.g. "https://horizon.stellar.org" */
  url: string;
  /** Network label, e.g. "mainnet", "testnet", "futurenet" */
  network: string;
  /** Relative weight used by the `weighted` strategy (default 1). */
  weight?: number;
}

/** Live health snapshot for one endpoint. */
export interface EndpointHealth {
  endpoint: RpcEndpoint;
  status: EndpointStatus;
  /** Consecutive failures since the last successful call. */
  failureCount: number;
  /** Epoch-ms timestamp of the last status update. */
  lastCheckedAt: number;
  /** Last observed response latency in milliseconds. */
  responseTimeMs?: number;
}

/** Configuration passed to {@link RpcLoadBalancer}. */
export interface LoadBalancerConfig {
  endpoints: RpcEndpoint[];
  /** Consecutive failures before an endpoint is marked `down` (default 3). */
  maxFailures?: number;
  strategy?: SelectionStrategy;
}

/** Value returned by `RpcLoadBalancer.select()`. */
export interface SelectionResult {
  endpoint: RpcEndpoint;
  /** Index of the selected endpoint within the healthy-pool snapshot. */
  index: number;
}

/** Security-audit result for a single RPC endpoint. */
export interface AuditResult {
  endpoint: string;
  network: string;
  isSslValid: boolean;
  exposesSensitiveHeaders: boolean;
  corsPermissive: boolean;
  rateLimitPresent: boolean;
  /** Human-readable warnings emitted during the audit pass. */
  warnings: string[];
}

/** Aggregated output of a full audit run across all configured endpoints. */
export interface AuditReport {
  /** ISO-8601 timestamp when the report was compiled. */
  auditedAt: string;
  totalEndpoints: number;
  /** Number of endpoints that passed all checks with zero warnings. */
  passCount: number;
  /** Total number of warnings across all results. */
  warnCount: number;
  results: AuditResult[];
}