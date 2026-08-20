import { decode } from '@webassemblyjs/wasm-parser';

export interface WasmMetricSummary {
  byteSize: number;
  formattedSize: string;
  functionsCount: number;
  importsCount: number;
  exportsCount: number;
  memoryPagesMin: number;
  memoryPagesMax?: number;
  totalInstructions: number;
  branchInstructions: number;
  cyclomaticComplexityScore: number; // Estimated branch density ratio
  complexityRating: 'Low' | 'Moderate' | 'High' | 'Critical';
  recommendations: string[];
}

export class WasmComplexityAnalyzer {
  /**
   * Analyzes a WASM binary buffer offline and generates performance & complexity metrics.
   * @param wasmBuffer Uint8Array or Buffer containing compiled .wasm binary
   */
  public analyze(wasmBuffer: Uint8Array): WasmMetricSummary {
    const byteSize = wasmBuffer.byteLength;
    let functionsCount = 0;
    let importsCount = 0;
    let exportsCount = 0;
    let memoryPagesMin = 0;
    let memoryPagesMax: number | undefined = undefined;
    let totalInstructions = 0;
    let branchInstructions = 0;

    // Decode WASM Abstract Syntax Tree (AST) offline
    const ast = decode(wasmBuffer, { ignoreCodeSection: false });

    // Traverse AST nodes
    for (const bodyNode of ast.body) {
      if (bodyNode.type === 'Module') {
        for (const field of bodyNode.fields) {
          switch (field.type) {
            case 'ModuleImport':
              importsCount++;
              break;
            case 'ModuleExport':
              exportsCount++;
              break;
            case 'Memory':
              if (field.limits) {
                memoryPagesMin = field.limits.min || 0;
                memoryPagesMax = field.limits.max;
              }
              break;
            case 'Func':
              functionsCount++;
              // Analyze instruction AST inside code bodies
              if (field.body) {
                for (const instr of field.body) {
                  totalInstructions++;
                  // Track branching instructions for Cyclomatic Complexity calculation
                  if (
                    instr.type === 'Instr' &&
                    ['if', 'br', 'br_if', 'br_table', 'loop'].includes(instr.id)
                  ) {
                    branchInstructions++;
                  }
                }
              }
              break;
          }
        }
      }
    }

    // Calculate Cyclomatic Complexity (Control Flow Branch Density)
    const cyclomaticComplexityScore =
      totalInstructions > 0
        ? Number(((branchInstructions / totalInstructions) * 100).toFixed(2))
        : 0;

    const complexityRating = this.getComplexityRating(cyclomaticComplexityScore);
    const recommendations = this.generateRecommendations(
      byteSize,
      cyclomaticComplexityScore,
      importsCount,
    );

    return {
      byteSize,
      formattedSize: `${(byteSize / 1024).toFixed(2)} KB`,
      functionsCount,
      importsCount,
      exportsCount,
      memoryPagesMin,
      memoryPagesMax,
      totalInstructions,
      branchInstructions,
      cyclomaticComplexityScore,
      complexityRating,
      recommendations,
    };
  }

  private getComplexityRating(score: number): 'Low' | 'Moderate' | 'High' | 'Critical' {
    if (score < 5) return 'Low';
    if (score < 12) return 'Moderate';
    if (score < 20) return 'High';
    return 'Critical';
  }

  private generateRecommendations(
    byteSize: number,
    complexityScore: number,
    importsCount: number,
  ): string[] {
    const recs: string[] = [];

    if (byteSize > 256 * 1024) {
      recs.push(
        'Binary size exceeds 256 KB. Consider running `wasm-opt -Oz` or stripping debug symbols with `wasm-strip`.',
      );
    }
    if (complexityScore > 15) {
      recs.push(
        'High branch density detected. Refactor deep conditionals or nested loops to reduce execution gas costs.',
      );
    }
    if (importsCount > 30) {
      recs.push(
        'High number of external host function imports. Excessive host calls incur RPC/cross-boundary execution overhead.',
      );
    }
    if (recs.length === 0) {
      recs.push('WASM binary meets optimal size and control-flow complexity thresholds.');
    }

    return recs;
  }
}