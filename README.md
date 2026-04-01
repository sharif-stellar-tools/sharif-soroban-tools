<div align="center">
  <h1>sharif-soroban-tools</h1>
  <p><strong>Advanced CLI toolkit & developer suite for auditing, debugging, and testing Soroban smart contracts.</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Soroban](https://img.shields.io/badge/Soroban-v20%2B-purple)](https://soroban.stellar.org)
  [![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange)](https://www.rust-lang.org)
</div>

<br />

## 📖 Overview

`sharif-soroban-tools` is a developer utility CLI and SDK crafted for Soroban smart contract engineers on Stellar. It accelerates contract debugging, structural auditing, and state simulation by offering features missing from standard toolchains:

- **Contract Diffing**: Structural bytecode & ABI comparisons between deployed contracts.
- **Event Replay**: Sequential historical contract event replay for state debugging.
- **Network Snapshots**: Deterministic ledger snapshotting and state restoration for local test environments.
- **Interactive Wizard Mode**: Type-safe CLI prompt execution for complex Soroban function calls.
- **Build Telemetry**: Contract WASM size, instruction count, and resource fee metrics extraction.

---

## 🏗️ System Architecture

```
+-------------------------------------------------------------------------+
|                         sharif-soroban CLI                              |
|                                                                         |
|  +--------------------+  +-------------------+  +--------------------+  |
|  |   Contract Diff    |  |   Event Replay    |  |  Interactive Invk  |  |
|  +--------------------+  +-------------------+  +--------------------+  |
|  +--------------------+  +-------------------+  +--------------------+  |
|  |  State Snapshotter |  |  WASM Telemetry   |  |   ABI Parser Engine|  |
|  +--------------------+  +-------------------+  +--------------------+  |
+-------------------------------------------------------------------------+
            |                                       |
            v                                       v
+-----------------------+               +-----------------------+
|  Soroban RPC Node     |               |   WASM Artifact (.wasm)|
+-----------------------+               +-----------------------+
```

---

## 🛠️ Installation & Setup

### Prerequisites

- **Rust**: 1.75+ with `wasm32-unknown-unknown` target
- **Soroban CLI**: `cargo install --locked soroban-cli`
- **Node.js**: v18+ (for JavaScript SDK helpers)

### Build from Source

```bash
git clone https://github.com/sharif-stellar-tools/sharif-soroban-tools.git
cd sharif-soroban-tools
cargo build --release
cargo install --path .
```

---

## 💡 CLI Usage & Examples

### 1. Structural Contract Diffing

Compare exported functions, storage schemas, and WASM bytecodes between two on-chain contract deployments:

```bash
sharif-soroban diff CABC...V1 CXYZ...V2 --network testnet
```

*Output:*
```text
[+] Added Function: claim_airdrop(user: Address, proof: Bytes)
[-] Removed Function: legacy_mint(amount: i128)
[*] Changed Storage Key: Admin -> Map<Symbol, Address>
```

### 2. Contract Event Replay

Reconstruct historical on-chain state transitions by replaying decoded events from a target ledger range:

```bash
sharif-soroban event-replay \
  --contract-id CDEX...123 \
  --from-ledger 100450 \
  --to-ledger 100900 \
  --jsonl > events.jsonl
```

### 3. Local Standalone Network Snapshot & Restore

Capture the entire ledger state of a local Soroban node into a compressed archive and restore it reproducibly:

```bash
# Capture snapshot
sharif-soroban snapshot save --output testnet-state-v1.ssnapshot

# Restore state on fresh node
sharif-soroban snapshot restore --input testnet-state-v1.ssnapshot
```

### 4. Interactive Invocation Wizard Mode

Execute contract functions without hand-crafting complex XDR argument strings:

```bash
sharif-soroban invoke --contract-id CAV...99 --wizard
```

---

## 🧪 Testing & Quality Assurance

```bash
# Run unit tests
cargo test

# Run CLI integration test suite against local standalone Stellar node
cargo test --test integration_tests -- --nocapture
```

---

## 🛣️ Roadmap & Active GitHub Issues

- [[Feature] Add contract diff command to compare two deployed versions](https://github.com/sharif-stellar-tools/sharif-soroban-tools/issues/1)
- [[Feature] Implement event replay command for historical contract debugging](https://github.com/sharif-stellar-tools/sharif-soroban-tools/issues/2)
- [[Tooling] Add network snapshot and restore commands for deterministic test environments](https://github.com/sharif-stellar-tools/sharif-soroban-tools/issues/3)
- [[DX] Add interactive invoke wizard mode for contract function calls](https://github.com/sharif-stellar-tools/sharif-soroban-tools/issues/4)
- [[Observability] Emit structured build telemetry and surface contract complexity metrics](https://github.com/sharif-stellar-tools/sharif-soroban-tools/issues/5)

---

## 📄 License

Licensed under the MIT License. See [LICENSE](./LICENSE) for details.
