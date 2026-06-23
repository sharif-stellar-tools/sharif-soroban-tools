<div align="center">
  <h1>sharif-soroban-tools</h1>
  <p><strong>High-performance Rust CLI and debugging tools for Soroban smart contracts.</strong></p>
</div>

<br />

## 📖 Overview

sharif-soroban-tools is a critical component of our decentralized ecosystem. This repository contains the source code, tests, and deployment configurations necessary to run the service. Built with modern, enterprise-grade architecture, it ensures high availability, secure execution, and seamless integration with the broader network.

## ✨ Key Features

- **Robust Architecture**: Designed to handle high-throughput and scale horizontally.
- **Secure by Default**: Follows industry-standard security practices and comprehensive auditing guidelines.
- **Extensible Integration**: Exposes clean, well-documented interfaces for third-party extensions.
- **Comprehensive Testing**: Backed by a strict CI/CD pipeline enforcing an 85%+ code coverage requirement.

## 🚀 Getting Started

### Prerequisites

- Make sure you have the latest stable versions of our core toolchains (e.g., Node.js, Rust/Cargo) installed.
- Ensure Docker is installed for running localized integration environments.

### Local Installation

```bash
# Clone the repository
git clone https://github.com/YourOrganization/sharif-soroban-tools.git
cd sharif-soroban-tools

# Install dependencies and build
npm install
npm run build

# Link the CLI for local use
npm link
```

## 🛠 CLI Usage

The `sharif-soroban` CLI provides tools for rapid development.

### Initialize a new project

Scaffold a new Soroban contract project interactively:

```bash
sharif-soroban init
```

Or provide arguments directly:

```bash
sharif-soroban init my-project --template hello-world --network standalone
```

**Options:**
- `project-name`: (Optional) The name of the directory to create.
- `-t, --template <type>`: Template type (`empty`, `hello-world`, `token`). Default: `hello-world`.
- `-n, --network <type>`: Network configuration (`testnet`, `standalone`). Default: `testnet`.

### Deployment & Testing

For contract deployment and integration testing, refer to the [Quickstart Guide](docs/quickstart.md).

## 🔍 Linting & Formatting

This project uses [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) to enforce code quality and consistent formatting across all TypeScript/JavaScript sources.

```bash
# Run the linter (reports errors and warnings)
npm run lint

# Auto-fix lint issues where possible
npm run lint:fix

# Format all files with Prettier
npm run format

# Check formatting without writing changes (useful in CI)
npm run format:check
```

> **Tip:** Run `npm run lint` and `npm run format:check` before opening a Pull Request to ensure your code meets the project standards.

## 🤝 Contributing

We welcome contributions from the community! Please read our [Contributing Guidelines](./CONTRIBUTING.md) to get started. Before submitting a Pull Request, ensure that you have reviewed our [Code of Conduct](./CODE_OF_CONDUCT.md).

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for more details.
