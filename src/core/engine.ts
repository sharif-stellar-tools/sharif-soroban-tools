// Complex Core Engine Simulation
import { execSync } from 'child_process';
import * as path from 'path';
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

  /**
   * Deploys a Soroban contract WASM to the specified network.
   * Uses soroban-cli internally.
   */
  public async deployContract(
    wasmPath: string,
    network: string = 'standalone',
    rpcUrl: string = 'http://localhost:8000/soroban/rpc',
    source: string = 'alice',
  ): Promise<{ success: boolean; contractId?: string; error?: string }> {
    try {
      console.log(`Deploying ${wasmPath} to ${network}...`);
      const command = `soroban contract deploy --wasm "${wasmPath}" --source ${source} --network ${network} --rpc-url ${rpcUrl}`;
      const output = execSync(command, { encoding: 'utf8' });
      const contractId = output.trim();
      console.log(`Successfully deployed. Contract ID: ${contractId}`);
      return { success: true, contractId };
    } catch (error: any) {
      console.error('Deployment failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Builds a Soroban contract from a given manifest path.
   * Uses soroban-cli internally.
   */
  public async buildContract(manifestPath: string): Promise<{ success: boolean; wasmPath?: string; error?: string }> {
    try {
      console.log(`Building contract at ${manifestPath}...`);
      const command = `soroban contract build --manifest-path "${manifestPath}"`;
      execSync(command, { stdio: 'inherit' });

      // Derive the WASM path (simple heuristic matching tutorial.rs)
      const projectDir = path.dirname(manifestPath);
      const projectName = JSON.parse(execSync('cargo metadata --no-deps --format-version 1', { cwd: projectDir, encoding: 'utf8' })).packages[0].name;
      const snakeName = projectName.replace(/-/g, '_');
      const wasmPath = path.join(projectDir, 'target', 'wasm32-unknown-unknown', 'release', `${snakeName}.wasm`);

      return { success: true, wasmPath };
    } catch (error: any) {
      console.error('Build failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Funds a Soroban identity from the network friendbot.
   * Uses soroban-cli internally.
   */
  public async fundAccount(
    source: string = 'alice',
    network: string = 'standalone',
    rpcUrl: string = 'http://localhost:8000/soroban/rpc',
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Funding account ${source} on ${network}...`);
      const command = `soroban keys fund ${source} --network ${network} --rpc-url ${rpcUrl}`;
      execSync(command, { stdio: 'inherit' });
      return { success: true };
    } catch (error: any) {
      console.error('Funding failed:', error.message);
      return { success: false, error: error.message };
    }
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
