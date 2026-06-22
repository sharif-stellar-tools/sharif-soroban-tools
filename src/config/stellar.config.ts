/**
 * Known Horizon/RPC endpoint URLs indexed by network name.
 * Override via environment variables in production.
 */
export const HORIZON_BASE_URLS: Record<string, string> = {
  testnet: process.env.HORIZON_TESTNET_URL ?? 'https://horizon-testnet.stellar.org',
  mainnet: process.env.HORIZON_MAINNET_URL ?? 'https://horizon.stellar.org',
};
