mod diff;
mod replay;
mod snapshot;
mod wizard;

use clap::{Parser, Subcommand, Args};

#[derive(Parser)]
#[command(name = "sharif-soroban")]
#[command(about = "Advanced CLI toolkit & developer suite for auditing, debugging, and testing Soroban smart contracts", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Compare exported functions, storage schemas, and WASM bytecodes between two contracts
    Diff(DiffArgs),
    /// Reconstruct historical on-chain state transitions by replaying decoded events
    EventReplay(EventReplayArgs),
    /// Deterministic ledger snapshotting and state restoration
    Snapshot(SnapshotArgs),
    /// Execute contract functions with interactive wizard mode or direct calls
    Invoke(InvokeArgs),
}

#[derive(Args)]
struct DiffArgs {
    /// Address or file path of contract A
    contract_a: String,
    /// Address or file path of contract B
    contract_b: String,
    /// Network connection (e.g. testnet, mainnet, local)
    #[arg(short, long, default_value = "testnet")]
    network: String,
}

#[derive(Args)]
struct EventReplayArgs {
    /// Contract address to replay events for
    #[arg(short, long)]
    contract_id: String,
    /// Starting ledger index
    #[arg(short, long)]
    from_ledger: u32,
    /// Ending ledger index
    #[arg(short, long)]
    to_ledger: u32,
    /// Print replayed events in JSON Lines format
    #[arg(long)]
    jsonl: bool,
}

#[derive(Args)]
struct SnapshotArgs {
    #[command(subcommand)]
    action: SnapshotAction,
}

#[derive(Subcommand)]
enum SnapshotAction {
    /// Save ledger state to a compressed file
    Save {
        /// File path to save snapshot to
        #[arg(short, long)]
        output: String,
    },
    /// Restore ledger state from a compressed file
    Restore {
        /// File path to read snapshot from
        #[arg(short, long)]
        input: String,
    },
}

#[derive(Args)]
struct InvokeArgs {
    /// Contract address to invoke
    #[arg(short, long)]
    contract_id: String,
    /// Run in interactive wizard prompt mode
    #[arg(short, long)]
    wizard: bool,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Diff(args) => {
            diff::execute_diff(&args.contract_a, &args.contract_b, &args.network);
        }
        Commands::EventReplay(args) => {
            replay::execute_replay(&args.contract_id, args.from_ledger, args.to_ledger, args.jsonl);
        }
        Commands::Snapshot(args) => {
            match args.action {
                SnapshotAction::Save { output } => {
                    snapshot::execute_save(&output);
                }
                SnapshotAction::Restore { input } => {
                    snapshot::execute_restore(&input);
                }
            }
        }
        Commands::Invoke(args) => {
            if args.wizard {
                wizard::execute_wizard(&args.contract_id);
            } else {
                println!("Non-wizard invocation mode is not implemented. Please run with --wizard.");
            }
        }
    }
}
