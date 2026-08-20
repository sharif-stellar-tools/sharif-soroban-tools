import * as fs from 'fs';
import * as path from 'path';
import { WasmComplexityAnalyzer } from '../analyzer/wasm-complexity-analyzer';

function runCli() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Error: Please provide a path to a .wasm file.');
    console.log('Usage: npx ts-node analyze-wasm.ts <path-to-file.wasm>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found at ${resolvedPath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(resolvedPath);
  const analyzer = new WasmComplexityAnalyzer();
  const report = analyzer.analyze(fileBuffer);

  console.log('\n====================================================');
  console.log('         OFFLINE WASM COMPLEXITY REPORT             ');
  console.log('====================================================');
  console.log(`File:                      ${path.basename(filePath)}`);
  console.log(`Size:                      ${report.formattedSize} (${report.byteSize} bytes)`);
  console.log(`Internal Functions:        ${report.functionsCount}`);
  console.log(`Imports / Exports:         ${report.importsCount} / ${report.exportsCount}`);
  console.log(`Memory Pages (Min/Max):    ${report.memoryPagesMin} / ${report.memoryPagesMax || 'unlimited'}`);
  console.log(`Total Instructions:        ${report.totalInstructions}`);
  console.log(`Branch Instructions:       ${report.branchInstructions}`);
  console.log(`Cyclomatic Complexity:     ${report.cyclomaticComplexityScore}% (${report.complexityRating})`);
  console.log('----------------------------------------------------');
  console.log('Optimization Recommendations:');
  report.recommendations.forEach((rec, idx) => {
    console.log(`  ${idx + 1}. ${rec}`);
  });
  console.log('====================================================\n');
}

runCli();