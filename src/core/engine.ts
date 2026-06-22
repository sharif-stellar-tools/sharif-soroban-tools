// Complex Core Engine Simulation
import {
  StellarEnvelope,
  validateFeeBumpTransactionEnvelope,
  getTransactionEnvelopeFee,
  isFeeBumpTransactionEnvelope,
} from './transaction';

export class CoreEngine {
  constructor() {
    console.log('Engine initialized');
  }

  public async processTx(envelope: StellarEnvelope, baseFee = 100): Promise<boolean> {
    if (isFeeBumpTransactionEnvelope(envelope)) {
      const result = validateFeeBumpTransactionEnvelope(envelope, baseFee);
      if (!result.valid) {
        console.error('Fee bump validation failed:', result.error);
        return false;
      }
      console.log(`Processing fee bump transaction with fee ${envelope.feeBumpTx.fee}`);
      console.log(`Inner tx source: ${envelope.feeBumpTx.innerTx.sourceAccount}`);
    } else {
      console.log(`Processing transaction with fee ${envelope.tx.fee}`);
    }

    console.log(`Total envelope fee: ${getTransactionEnvelopeFee(envelope)}`);
    return true;
  }

  public async submitEnvelope(
    envelope: StellarEnvelope,
    baseFee = 100,
  ): Promise<{ success: boolean; reason?: string }> {
    const processed = await this.processTx(envelope, baseFee);
    if (!processed) {
      return {
        success: false,
        reason: 'Invalid transaction envelope: fee bump validation failed.',
      };
    }
    return { success: true };
  }
}
