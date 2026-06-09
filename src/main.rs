mod deploy;

use clap::Parser;

#[derive(Parser)]
struct Cli {
    #[arg(short, long)]
    contract_path: String,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    println!("Deploying contract from {}", cli.contract_path);
    deploy::execute_deploy(&cli.contract_path).await;
}
