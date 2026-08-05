mod deploy;
mod tutorial;
mod rpc;
mod wasm_inspect;
mod diff;

use clap::{Parser, Subcommand};
use std::path::Path;
use std::process;

#[derive(Parser)]
#[command(name = "sharif-soroban-tools", about = "CLI tools for Soroban smart contracts")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Deploy a compiled WASM contract
    Deploy {
        #[arg(short, long)]
        contract_path: String,
    },
    /// Interactive tutorial: walks through init → build → deploy
    Tutorial,
    /// Compare two deployed contracts
    Diff {
        contract_id_v1: String,
        contract_id_v2: String,
        #[arg(long, default_value = "testnet")]
        network: String,
        #[arg(long)]
        json: bool,
    },
}

pub fn validate_wasm_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);

    if !p.exists() || !p.is_file() {
        return Err(format!(
            "Error: File does not exist or is not a WASM contract: {}",
            path
        ));
    }

    match p.extension().and_then(|e| e.to_str()) {
        Some("wasm") => Ok(()),
        _ => Err(format!(
            "Error: File does not exist or is not a WASM contract: {}",
            path
        )),
    }
}

async fn execute_diff(id_v1: &str, id_v2: &str, network: &str, json: bool) -> Result<(), String> {
    let wasm_v1 = rpc::fetch_contract_wasm(id_v1, network).await?;
    let wasm_v2 = rpc::fetch_contract_wasm(id_v2, network).await?;

    let exports_v1 = wasm_inspect::extract_exports(&wasm_v1)?;
    let exports_v2 = wasm_inspect::extract_exports(&wasm_v2)?;

    let diffs = diff::diff_exports(&exports_v1, &exports_v2);

    if json {
        let json_output = serde_json::to_string_pretty(&diffs)
            .map_err(|e| format!("Failed to serialize diff to JSON: {}", e))?;
        println!("{}", json_output);
    } else {
        use colored::Colorize;
        if diffs.is_empty() {
            println!("No differences found. The contract public APIs are identical.");
            return Ok(());
        }

        println!("Public API Diff between {} and {}:", id_v1, id_v2);
        println!("--------------------------------------------------");
        for entry in diffs {
            match entry.kind {
                diff::DiffKind::Added => {
                    let matching_f2 = exports_v2.iter().find(|f| f.name == entry.name).unwrap();
                    let sig = diff::format_sig(matching_f2);
                    println!("{} {}", "+".green(), sig.green());
                }
                diff::DiffKind::Removed => {
                    let matching_f1 = exports_v1.iter().find(|f| f.name == entry.name).unwrap();
                    let sig = diff::format_sig(matching_f1);
                    println!("{} {}", "-".red(), sig.red());
                }
                diff::DiffKind::Changed { v1_sig, v2_sig } => {
                    println!("{} Changed: {}", "~".yellow(), entry.name.yellow());
                    println!("  {} {}", "-".red(), v1_sig.red());
                    println!("  {} {}", "+".green(), v2_sig.green());
                }
            }
        }
    }

    Ok(())
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    match cli.command {
        Command::Deploy { contract_path } => {
            if let Err(e) = validate_wasm_path(&contract_path) {
                eprintln!("{}", e);
                process::exit(1);
            }
            println!("Deploying contract from {}", contract_path);
            deploy::execute_deploy(&contract_path).await;
        }
        Command::Tutorial => {
            tutorial::run();
        }
        Command::Diff {
            contract_id_v1,
            contract_id_v2,
            network,
            json,
        } => {
            if let Err(e) = execute_diff(&contract_id_v1, &contract_id_v2, &network, json).await {
                eprintln!("{}", e);
                process::exit(1);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::validate_wasm_path;
    use std::fs;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn rejects_nonexistent_path() {
        let result = validate_wasm_path("/nonexistent/path/contract.wasm");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Error:"));
    }

    #[test]
    fn rejects_wrong_extension() {
        let mut tmp = NamedTempFile::new().unwrap();
        writeln!(tmp, "dummy").unwrap();
        let txt_path = tmp.path().with_extension("txt");
        fs::copy(tmp.path(), &txt_path).unwrap();
        let result = validate_wasm_path(txt_path.to_str().unwrap());
        fs::remove_file(&txt_path).unwrap();
        assert!(result.is_err());
    }

    #[test]
    fn accepts_valid_wasm_file() {
        let mut tmp = NamedTempFile::new().unwrap();
        writeln!(tmp, "dummy wasm content").unwrap();
        let wasm_path = tmp.path().with_extension("wasm");
        fs::copy(tmp.path(), &wasm_path).unwrap();
        let result = validate_wasm_path(wasm_path.to_str().unwrap());
        fs::remove_file(&wasm_path).unwrap();
        assert!(result.is_ok());
    }
}