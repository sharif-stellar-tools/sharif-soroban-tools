import { WasmComplexityAnalyzer } from '../src/analyzer/wasm-complexity-analyzer';

describe('WasmComplexityAnalyzer', () => {
  let analyzer: WasmComplexityAnalyzer;

  beforeEach(() => {
    analyzer = new WasmComplexityAnalyzer();
  });

  // Minimal valid WebAssembly binary header magic bytes (`\0asm\1\0\0\0`)
  const MINIMAL_WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

  it('should successfully parse a valid WASM binary header', () => {
    const result = analyzer.analyze(MINIMAL_WASM);

    expect(result.byteSize).toBe(8);
    expect(result.functionsCount).toBe(0);
    expect(result.cyclomaticComplexityScore).toBe(0);
    expect(result.complexityRating).toBe('Low');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});