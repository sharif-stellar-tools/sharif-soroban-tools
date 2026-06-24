import { CoreEngine } from '../../src/core/engine';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Contract Deployment Integration', () => {
  let engine: CoreEngine;
  const manifestPath = path.resolve(__dirname, 'fixtures/hello-world/Cargo.toml');
  const network = 'standalone';
  const rpcUrl = 'http://localhost:8000/soroban/rpc';
  const source = 'alice';

  beforeAll(async () => {
    engine = new CoreEngine();
    
    // Ensure the identity exists and is funded
    console.log('Generating and funding identity...');
    try {
        execSync(`soroban keys generate ${source} --overwrite --network ${network} --rpc-url ${rpcUrl}`, { stdio: 'inherit' });
    } catch (e) {
        // If generate fails, maybe it already exists or network is down
        console.warn('Key generation might have failed, attempting to fund anyway.');
    }
    await engine.fundAccount(source, network, rpcUrl);
  }, 60000); // 1 minute timeout for setup

  it('successfully builds and deploys a contract to the local ledger', async () => {
    // 1. Build
    const buildResult = await engine.buildContract(manifestPath);
    expect(buildResult.success).toBe(true);
    expect(buildResult.wasmPath).toBeDefined();
    
    const wasmPath = buildResult.wasmPath!;

    // 2. Deploy
    const deployResult = await engine.deployContract(wasmPath, network, rpcUrl, source);
    expect(deployResult.success).toBe(true);
    expect(deployResult.contractId).toBeDefined();
    expect(deployResult.contractId).toMatch(/^[0-9a-f]{64}$/i); // Contract IDs are 64-char hex

    const contractId = deployResult.contractId!;

    // 3. Verify existence on ledger (via soroban contract read-current-ledger or just by invoking it)
    // We can try to invoke the 'hello' function to verify it works
    console.log(`Verifying contract ${contractId} by invoking 'hello'...`);
    const invokeCommand = `soroban contract invoke --id ${contractId} --source ${source} --network ${network} --rpc-url ${rpcUrl} -- hello --to IntegrationTest`;
    const output = execSync(invokeCommand, { encoding: 'utf8' });
    
    expect(output).toContain('Hello');
    expect(output).toContain('IntegrationTest');
  }, 120000); // 2 minute timeout for build and deploy
});
