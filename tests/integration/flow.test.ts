import { CoreEngine } from '../../src/core/engine';
import { router } from '../../src/api/router';
import {
  TransactionEnvelope,
  FeeBumpTransactionEnvelope,
} from '../../src/core/transaction';

const validTx = (): TransactionEnvelope => ({
  type: 'transaction',
  tx: {
    sourceAccount: 'GSOURCE',
    fee: 100,
    sequenceNumber: '1000000000',
    operations: [{ type: 'payment', amount: '50', destination: 'GDEST' }],
    signatures: [{ hint: 'abcd', signature: 'deadsig' }],
  },
});

const validFeeBump = (): FeeBumpTransactionEnvelope => ({
  type: 'feeBump',
  feeBumpTx: {
    feeSource: 'GFEESOURCE',
    fee: 200,
    innerTx: {
      sourceAccount: 'GINNER',
      fee: 100,
      sequenceNumber: '1000000001',
      operations: [{ type: 'payment', amount: '10', destination: 'GDEST' }],
      signatures: [{ hint: '1234', signature: 'innersig' }],
    },
    signatures: [{ hint: '5678', signature: 'outersig' }],
  },
});

describe('Core Flow — end-to-end', () => {
  let engine: CoreEngine;

  beforeEach(() => {
    engine = new CoreEngine();
  });

  it('processes a standard transaction envelope', async () => {
    const result = await engine.submitEnvelope(validTx());
    expect(result.success).toBe(true);
  });

  it('processes a fee-bump transaction envelope', async () => {
    const result = await engine.submitEnvelope(validFeeBump());
    expect(result.success).toBe(true);
  });

  it('rejects a fee-bump envelope where top-level fee is too low', async () => {
    const env = validFeeBump();
    env.feeBumpTx.fee = 10; // below baseFee * ops
    const result = await engine.submitEnvelope(env);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Invalid transaction envelope');
  });

  it('router.handle delegates correctly for a valid envelope', async () => {
    const result = await router.handle({ envelope: validTx() });
    expect(result.success).toBe(true);
  });

  it('router.handle propagates failure for an invalid fee-bump', async () => {
    const env = validFeeBump();
    env.feeBumpTx.fee = 5;
    const result = await router.handle({ envelope: env });
    expect(result.success).toBe(false);
  });
});
