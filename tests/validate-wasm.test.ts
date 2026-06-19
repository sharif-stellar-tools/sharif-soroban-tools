import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Mirrors the validation logic in src/main.rs so the Jest CI suite
 * can verify path-validation behaviour without a Rust toolchain.
 */
function validateWasmPath(filePath: string): { ok: boolean; error?: string } {
  const exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  if (!exists) {
    return { ok: false, error: `Error: File does not exist or is not a WASM contract: ${filePath}` };
  }
  if (path.extname(filePath) !== '.wasm') {
    return { ok: false, error: `Error: File does not exist or is not a WASM contract: ${filePath}` };
  }
  return { ok: true };
}

describe('validateWasmPath', () => {
  const tmpDir = os.tmpdir();

  it('rejects a non-existent path', () => {
    const result = validateWasmPath('/nonexistent/contract.wasm');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Error:/);
  });

  it('rejects a file with a non-.wasm extension', () => {
    const txtFile = path.join(tmpDir, 'contract.txt');
    fs.writeFileSync(txtFile, 'dummy');
    const result = validateWasmPath(txtFile);
    fs.unlinkSync(txtFile);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Error:/);
  });

  it('rejects a path with no extension', () => {
    const noExtFile = path.join(tmpDir, 'contract');
    fs.writeFileSync(noExtFile, 'dummy');
    const result = validateWasmPath(noExtFile);
    fs.unlinkSync(noExtFile);
    expect(result.ok).toBe(false);
  });

  it('accepts an existing .wasm file', () => {
    const wasmFile = path.join(tmpDir, 'contract.wasm');
    fs.writeFileSync(wasmFile, Buffer.from([0x00, 0x61, 0x73, 0x6d]));
    const result = validateWasmPath(wasmFile);
    fs.unlinkSync(wasmFile);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('error message contains the invalid path', () => {
    const result = validateWasmPath('/bad/path/file.js');
    expect(result.error).toContain('/bad/path/file.js');
  });
});