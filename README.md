<div align="center">
  <h1>sharif-soroban-tools</h1>
  <p><strong>Tooling for developing, testing, and deploying Soroban smart contracts on the Stellar network.</strong></p>

  <p>
    <a href="https://github.com/sharif-stellar-tools/sharif-soroban-tools/actions/workflows/ci.yml">
      <img src="https://github.com/sharif-stellar-tools/sharif-soroban-tools/actions/workflows/ci.yml/badge.svg" alt="CI" />
    </a>
    <a href="./CONTRIBUTING.md">
      <img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg" alt="Contributions welcome" />
    </a>
    <img src="https://img.shields.io/badge/node-%3E%3D20-blue" alt="Node >= 20" />
    <img src="https://img.shields.io/badge/license-ISC-lightgrey" alt="License: ISC" />
  </p>
</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
  - [CLI — Scaffold a new project](#cli--scaffold-a-new-project)
  - [Core Engine — Process transaction envelopes](#core-engine--process-transaction-envelopes)
  - [Transaction utilities](#transaction-utilities)
  - [RPC security audit script](#rpc-security-audit-script)
- [Configuration](#configuration)
- [Running tests](#running-tests)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

`sharif-soroban-tools` is a TypeScript/Rust toolkit that helps developers scaffold, build, test, and deploy [Soroban](https://soroban.stellar.org) smart contracts. It ships with:

- an interactive **CLI** to generate project scaffolding
- a **Core Engine** for processing and validating Stellar transaction envelopes (including fee-bump transactions)
- reusable **transaction utilities** (type guards, fee helpers, fee-bump validation)
- a **security audit script** that probes your RPC/Horizon load-balancing tier for common misconfigurations

For a step-by-step walkthrough from zero to a live "Hello World" contract, see [docs/quickstart.md](./docs/quickstart.md).

---

## Features

- **Project scaffolding** — interactive prompts generate a `soroban.config.json`-backed project in seconds, with `empty`, `hello-world`, and `token` templates
- **Fee-bump transaction support** — validate and process both standard and fee-bump `StellarEnvelope` types
- **RPC security auditing** — automated checks for permissive CORS, info-leaking headers, and missing rate-limit protection across your Horizon endpoints
- **TypeScript-first** — full type definitions for all Stellar envelope structures
- **Dual test suite** — Jest (TypeScript) and `cargo test` (Rust) with CI enforced on every PR

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Node.js | 20 | https://nodejs.org |
| npm | bundled with Node | — |
| Rust + Cargo | stable | https://rustup.rs |
| Soroban CLI | latest | `cargo install --locked soroban-cli` |
| Docker | any | https://docs.docker.com/get-docker/ (integration tests only) |

---

## Installation

```bash
hi# Install from npm
npm install sharif-soroban-tools
```

Or clone the repository and install dependencies locally:

```bash
git clone https://github.com/sharif-stellar-tools/sharif-soroban-tools.git
cd sharif-soroban-tools
npm install
```

---

## Usage

### CLI — Scaffold a new project

Run the interactive initialiser to generate a new Soroban project skeleton:

```bash
npx sharif-soroban-tools init
```

You will be prompted for three values:

| Prompt | Options | Default |
|---|---|---|
| Project name | any string | — |
| Template type | `empty` · `hello-world` · `token` | `hello-world` |
| Network | `testnet` · `standalone` | `testnet` |

After answering, the CLI creates a directory named after your project and writes a `soroban.config.json` inside it:

```json
{
  "projectName": "my-contract",
  "templateType": "hello-world",
  "network": "testnet"
}
```

You can also call `scaffoldProject` programmatically:

```typescript
import { scaffoldProject } from 'sharif-soroban-tools/cli/init';

const projectDir = scaffoldProject({
  projectName: 'my-contract',
  templateType: 'hello-world',
  network: 'testnet',
});

console.log(`Project created at: ${projectDir}`);
```

---

### Core Engine — Process transaction envelopes

The `CoreEngine` validates and processes both standard and fee-bump Stellar transaction envelopes.

```typescript
import { CoreEngine } from 'sharif-soroban-tools/core/engine';
import { TransactionEnvelope } from 'sharif-soroban-tools/core/transaction';

const engine = new CoreEngine();

// Build a standard transaction envelope
const envelope: TransactionEnvelope = {
  type: 'transaction',
  tx: {
    sourceAccount: 'GABC...XYZ',
    fee: 100,
    sequenceNumber: '1234567890',
    operations: [{ type: 'payment' }],
    signatures: [{ hint: 'aabb', signature: 'deadbeef' }],
  },
};

const result = await engine.submitEnvelope(envelope);

if (result.success) {
  console.log('Transaction submitted successfully');
} else {
  console.error('Submission failed:', result.reason);
}
```

#### Fee-bump transactions

```typescript
import { CoreEngine } from 'sharif-soroban-tools/core/engine';
import { FeeBumpTransactionEnvelope } from 'sharif-soroban-tools/core/transaction';

const engine = new CoreEngine();

const feeBumpEnvelope: FeeBumpTransactionEnvelope = {
  type: 'feeBump',
  feeBumpTx: {
    feeSource: 'GFEE...SRC',
    fee: 200,
    innerTx: {
      sourceAccount: 'GABC...XYZ',
      fee: 100,
      sequenceNumber: '1234567891',
      operations: [{ type: 'payment' }],
      signatures: [{ hint: 'aabb', signature: 'deadbeef' }],
    },
    signatures: [{ hint: 'ccdd', signature: 'cafebabe' }],
  },
};

// baseFee defaults to 100 stroops per operation
const result = await engine.submitEnvelope(feeBumpEnvelope, 100);
console.log(result); // { success: true }
```

---

### Transaction utilities

The `transaction` module exports lightweight helpers that work independently of the engine.

```typescript
import {
  isFeeBumpTransactionEnvelope,
  getTransactionEnvelopeFee,
  getFeeBumpInnerTransaction,
  validateFeeBumpTransactionEnvelope,
  StellarEnvelope,
} from 'sharif-soroban-tools/core/transaction';

// Type guard
if (isFeeBumpTransactionEnvelope(envelope)) {
  const innerTx = getFeeBumpInnerTransaction(envelope);
  console.log('Inner tx source:', innerTx.sourceAccount);
}

// Read the effective fee regardless of envelope type
const fee = getTransactionEnvelopeFee(envelope);

// Validate a fee-bump envelope against a base fee
const validation = validateFeeBumpTransactionEnvelope(feeBumpEnvelope, 100);
if (!validation.valid) {
  console.error(validation.error);
  console.log('Minimum required fee:', validation.expectedMinimumFee);
}
```

---

### RPC security audit script

The audit script checks every configured Horizon endpoint for common security misconfigurations: permissive CORS policies, server header leakage, and missing rate-limit protection.

```bash
npx ts-node src/scripts/audit-rpc-load-balancer.ts
```

The script prints a summary table similar to:

```
┌────────────────────────────────────┬────────────┬──────────────────────┬─────────────────┬──────────────────────┐
│ endpoint                           │ isSslValid │ exposesSensitiveHdrs │ corsPermissive  │ rateLimitResponsive  │
├────────────────────────────────────┼────────────┼──────────────────────┼─────────────────┼──────────────────────┤
│ https://horizon-testnet.stellar.org│ true       │ false                │ false           │ true                 │
└────────────────────────────────────┴────────────┴──────────────────────┴─────────────────┴──────────────────────┘
```

The target endpoints are configured in `src/config/stellar.config.ts` via the `HORIZON_BASE_URLS` map.

---

## Configuration

After scaffolding, a `soroban.config.json` file is placed in your project directory:

```json
{
  "projectName": "my-contract",
  "templateType": "hello-world",
  "network": "testnet"
}
```

| Field | Type | Description |
|---|---|---|
| `projectName` | `string` | Display name used for tooling output |
| `templateType` | `"empty"` \| `"hello-world"` \| `"token"` | Starter template applied during scaffolding |
| `network` | `"testnet"` \| `"standalone"` | Target Stellar network |

For Rust components, standard `Cargo.toml` configuration applies. See [`Cargo.toml`](./Cargo.toml) for workspace-level settings.

---

## Running tests

```bash
# TypeScript / Jest
npm test

# Rust unit and integration tests
cargo test

# Lint
npm run lint
```

The CI pipeline runs both suites automatically on every push and pull request (see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).

---

## Project structure

```
sharif-soroban-tools/
├── src/
│   ├── api/
│   │   └── router.ts            # HTTP router wired to CoreEngine
│   ├── cli/
│   │   └── init.ts              # Interactive project scaffolding CLI
│   ├── core/
│   │   ├── engine.ts            # CoreEngine — envelope processing & submission
│   │   └── transaction.ts       # Stellar envelope types, guards, and validators
│   ├── scripts/
│   │   └── audit-rpc-load-balancer.ts  # RPC/Horizon security audit
│   ├── deploy.rs                # Rust deployment helper
│   ├── lib.rs                   # Rust library root
│   └── main.rs                  # Rust binary entry point
├── tests/
│   ├── core_transaction.test.ts # Unit tests for transaction utilities
│   ├── init.test.ts             # Unit tests for CLI init
│   ├── validate-wasm.test.ts    # WASM validation tests
│   ├── integration/
│   │   └── flow.test.ts         # End-to-end integration flow
│   ├── core_test.rs             # Rust unit tests
│   └── integration_test.rs      # Rust integration tests
├── docs/
│   └── quickstart.md            # Step-by-step Hello World walkthrough
├── Cargo.toml
├── package.json
├── tsconfig.json
└── jest.config.js
```

---

## Contributing

Contributions of all kinds are welcome — bug reports, feature requests, documentation improvements, and code. Please read the [Contributing Guidelines](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md) before opening a pull request.

Quick summary:

1. Fork the repo and create a branch (`feat/my-feature`, `fix/bug-name`, etc.)
2. Make your changes and add or update tests
3. Run `npm test` and `cargo test` to confirm everything passes
4. Open a PR against the `master` branch — reference the relevant issue with `Closes #<number>`

For a full walkthrough of the local development setup, commit conventions, and review process, see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

This project is licensed under the [ISC License](./LICENSE).
