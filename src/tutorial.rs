//! Interactive tutorial mode (`--tutorial` / `tutorial` subcommand).
//!
//! Walks the user through the full hello-world Soroban contract lifecycle:
//!   Step 1 — Init   : scaffold a new contract project
//!   Step 2 — Build  : compile to WASM via `soroban contract build`
//!   Step 3 — Deploy : deploy the WASM with `soroban contract deploy`

use std::io::{self, BufRead, Write};
use std::process::Command;

// ── helpers ──────────────────────────────────────────────────────────────────

fn prompt(question: &str, default: &str) -> String {
    print!("{} [{}]: ", question, default);
    io::stdout().flush().unwrap();

    let stdin = io::stdin();
    let line = stdin.lock().lines().next();
    let input = line
        .and_then(|r| r.ok())
        .map(|s| s.trim().to_owned())
        .unwrap_or_default();

    if input.is_empty() {
        default.to_owned()
    } else {
        input
    }
}

fn banner(title: &str) {
    let bar = "─".repeat(title.len() + 4);
    println!("\n┌{}┐", bar);
    println!("│  {}  │", title);
    println!("└{}┘", bar);
}

fn step(n: u8, label: &str) {
    println!("\n── Step {} · {} ──────────────────────────────", n, label);
}

fn run_cmd(program: &str, args: &[&str]) -> bool {
    println!("\n  $ {} {}", program, args.join(" "));
    match Command::new(program).args(args).status() {
        Ok(s) if s.success() => true,
        Ok(s) => {
            eprintln!("  ✗ Command exited with status: {}", s);
            false
        }
        Err(e) => {
            eprintln!("  ✗ Failed to run `{}`: {}", program, e);
            false
        }
    }
}

// ── tutorial steps ────────────────────────────────────────────────────────────

fn step_init(project_name: &str) -> bool {
    step(1, "Init");
    println!("  Scaffolding project `{}`…", project_name);

    if !run_cmd("mkdir", &["-p", &format!("contracts/{}/src", project_name)]) {
        return false;
    }

    // Write a minimal hello-world lib.rs
    let lib_path = format!("contracts/{}/src/lib.rs", project_name);
    let lib_src = r#"#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
"#;
    std::fs::write(&lib_path, lib_src).is_ok()
        && {
            // Write a minimal Cargo.toml for the contract crate
            let cargo_path = format!("contracts/{}/Cargo.toml", project_name);
            let cargo_src = format!(
                r#"[package]
name = "{}"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = {{ version = "20", features = ["alloc"] }}
"#,
                project_name
            );
            std::fs::write(&cargo_path, cargo_src).is_ok()
        }
}

fn step_build(project_name: &str) -> Option<String> {
    step(2, "Build");
    let manifest = format!("contracts/{}/Cargo.toml", project_name);
    println!("  Compiling contract to WASM…");

    if !run_cmd("soroban", &["contract", "build", "--manifest-path", &manifest]) {
        return None;
    }

    // Derive the conventional output path
    let snake = project_name.replace('-', "_");
    let wasm = format!(
        "contracts/{}/target/wasm32-unknown-unknown/release/{}.wasm",
        project_name, snake
    );
    println!("  WASM artefact: {}", wasm);
    Some(wasm)
}

fn step_deploy(wasm_path: &str, rpc_url: &str, network: &str, source: &str) -> bool {
    step(3, "Deploy");
    println!("  Deploying `{}` to {}…", wasm_path, network);

    run_cmd(
        "soroban",
        &[
            "contract",
            "deploy",
            "--wasm",
            wasm_path,
            "--source",
            source,
            "--network",
            network,
            "--rpc-url",
            rpc_url,
        ],
    )
}

// ── public entry point ────────────────────────────────────────────────────────

/// Runs the interactive tutorial.  Reads from stdin so it works in both
/// a real TTY and programmatic (piped) contexts.
pub fn run() {
    banner("Soroban Hello-World Tutorial");
    println!("  This tutorial walks you through the full contract lifecycle.");
    println!("  Press Enter to accept the default shown in [brackets].\n");

    let project = prompt("Project name", "hello-world");
    let network = prompt("Network (testnet / standalone)", "testnet");
    let rpc_url = match network.as_str() {
        "standalone" => prompt("RPC URL", "http://localhost:8000/soroban/rpc"),
        _ => prompt(
            "RPC URL",
            "https://soroban-testnet.stellar.org",
        ),
    };
    let source = prompt("Signing identity (soroban keys name)", "alice");

    println!("\nConfiguration:");
    println!("  project : {}", project);
    println!("  network : {}", network);
    println!("  rpc     : {}", rpc_url);
    println!("  source  : {}", source);

    let confirm = prompt("\nContinue? (y/n)", "y");
    if confirm.to_lowercase() != "y" {
        println!("Tutorial cancelled.");
        return;
    }

    // Step 1 — Init
    if !step_init(&project) {
        eprintln!("\n✗ Init failed. Aborting tutorial.");
        return;
    }
    println!("  ✓ Project scaffolded.");

    // Step 2 — Build
    let wasm_path = match step_build(&project) {
        Some(p) => p,
        None => {
            eprintln!("\n✗ Build failed. Aborting tutorial.");
            return;
        }
    };
    println!("  ✓ Contract compiled.");

    // Step 3 — Deploy
    if !step_deploy(&wasm_path, &rpc_url, &network, &source) {
        eprintln!("\n✗ Deploy failed. Check the RPC URL and network identity.");
        return;
    }
    println!("  ✓ Contract deployed.\n");

    println!("Tutorial complete! Your hello-world contract is live on {}.", network);
    println!("Next: invoke it with `soroban contract invoke --id <CONTRACT_ID> -- hello --to World`");
}
