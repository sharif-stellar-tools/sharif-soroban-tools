mod deploy;
mod tutorial;

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
