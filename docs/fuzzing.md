# Fuzzing Guide

This guide explains how to use the property-based fuzzing engine integrated into sharif-soroban-tools to automatically test contracts against a wide range of unexpected inputs.

## Overview

Fuzzing is a testing technique that automatically generates random inputs to find bugs and edge cases that traditional unit tests might miss. This project uses the `arbitrary` crate and `cargo-fuzz` to provide a robust fuzzing framework for Soroban smart contracts.

## Prerequisites

Before you begin, ensure you have the following installed:

- Rust and Cargo (latest stable)
- cargo-fuzz: Install with `cargo install cargo-fuzz`

```bash
cargo install cargo-fuzz
```

## Getting Started

### 1. Install Dependencies

The fuzzing dependencies are already included in the project's `Cargo.toml`:

```toml
[dev-dependencies]
arbitrary = "1"
```

The fuzz targets have their own `fuzz/Cargo.toml` with additional dependencies:

```toml
[dependencies]
libfuzzer-sys = "0.4"
arbitrary = "1"
sharif-soroban-tools = { path = ".." }
```

### 2. Available Fuzz Targets

The project includes the following pre-configured fuzz targets:

- **validate_wasm**: Tests the `validate_wasm_path` function with arbitrary file paths
- **deploy**: Tests deployment-related logic with arbitrary inputs
- **template**: A template file for creating custom fuzz targets

### 3. Running Fuzz Tests

#### Run a specific fuzz target:

```bash
cargo fuzz run validate_wasm
```

#### Run with custom options:

```bash
# Run for a specific duration (e.g., 60 seconds)
cargo fuzz run validate_wasm -- -max_total_time=60

# Run with a specific number of iterations
cargo fuzz run validate_wasm -- -runs=10000

# Run with multiple threads
cargo fuzz run validate_wasm -- -workers=4
```

#### List all available fuzz targets:

```bash
cargo fuzz list
```

## Creating Custom Fuzz Targets

### Step 1: Create a New Fuzz Target File

Copy the template file and rename it:

```bash
cp fuzz/fuzz_targets/template.rs fuzz/fuzz_targets/your_target.rs
```

### Step 2: Register the Target in Cargo.toml

Add a new `[[bin]]` entry to `fuzz/Cargo.toml`:

```toml
[[bin]]
name = "your_target"
path = "fuzz_targets/your_target.rs"
test = false
doc = false
bench = false
```

### Step 3: Implement Your Fuzz Target

Edit `fuzz/fuzz_targets/your_target.rs` to implement your fuzzing logic:

```rust
#![no_main]
use libfuzzer_sys::fuzz_target;
use arbitrary::{Arbitrary, Unstructured};

/// Simple byte-based fuzzing
fuzz_target!(|data: &[u8]| {
    // Your fuzzing logic here
    if let Ok(input) = std::str::from_utf8(data) {
        your_function(input);
    }
});

/// Or use structured fuzzing with Arbitrary trait
#[derive(Debug, Arbitrary)]
struct YourInput {
    field1: String,
    field2: u32,
}

fuzz_target!(|input: YourInput| {
    your_function(&input.field1, input.field2);
});
```

### Step 4: Run Your New Target

```bash
cargo fuzz run your_target
```

## Fuzzing Best Practices

1. **Keep it simple**: Fuzz targets should be fast and focused on testing specific functions
2. **Use assertions**: Add assertions to catch bugs early
3. **Test edge cases**: Fuzzing excels at finding boundary condition bugs
4. **Run for extended periods**: Let fuzzers run for hours or days to find rare bugs
5. **Minimize expensive operations**: Avoid slow operations in the fuzz loop
6. **Use structured inputs**: The `Arbitrary` trait helps generate meaningful test data

## Example: Fuzzing Contract Validation

The included `validate_wasm` target demonstrates how to fuzz the contract path validation:

```rust
fuzz_target!(|data: &[u8]| {
    if let Ok(unicode_str) = std::str::from_utf8(data) {
        let _ = sharif_soroban_tools::validate_wasm_path(unicode_str);
    }
});
```

This tests the validation function against millions of random string inputs, potentially finding:
- Buffer overflows
- Invalid UTF-8 handling issues
- Path traversal vulnerabilities
- Edge cases in file extension checking

## Troubleshooting

### cargo-fuzz not found

Install cargo-fuzz:
```bash
cargo install cargo-fuzz
```

### Build errors

Ensure you're using the latest stable Rust:
```bash
rustup update stable
rustup default stable
```

### Fuzzer hangs

Try limiting the runtime:
```bash
cargo fuzz run your_target -- -max_total_time=30
```

## Integration with CI/CD

To integrate fuzzing into your CI/CD pipeline, add a step that runs fuzz tests for a limited duration:

```yaml
# Example GitHub Actions step
- name: Run fuzz tests
  run: |
    cargo install cargo-fuzz
    cargo fuzz run validate_wasm -- -max_total_time=60
```

## Additional Resources

- [cargo-fuzz documentation](https://rust-fuzz.github.io/book/cargo-fuzz.html)
- [arbitrary crate documentation](https://docs.rs/arbitrary/)
- [Rust Fuzzing Book](https://rust-fuzz.github.io/book/)

## Contributing

When adding new fuzz targets:
1. Follow the naming convention: use descriptive names for your targets
2. Document what the target tests in comments
3. Add the target to this documentation
4. Ensure the target runs efficiently
