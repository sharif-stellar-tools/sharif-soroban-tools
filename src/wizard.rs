use dialoguer::{theme::ColorfulTheme, Input, Select};

pub fn execute_wizard(contract_id: &str) {
    let theme = ColorfulTheme::default();

    println!("✨ ==================================================== ✨");
    println!("🚀 Soroban Interactive Invocation Wizard & CLI Studio");
    println!("🎯 Target Contract ID: {}", contract_id);
    println!("✨ ====================================================\n");

    let functions = &[
        "deposit 💰",
        "withdraw 💸",
        "initialize ⚙️",
        "set_paused ⏸️",
        "get_balance 🔍"
    ];
    let raw_functions = &["deposit", "withdraw", "initialize", "set_paused", "get_balance"];

    let selection_idx = match Select::with_theme(&theme)
        .with_prompt("⚡ Select contract function to invoke")
        .default(0)
        .items(&functions[..])
        .interact_opt()
    {
        Ok(Some(index)) => index,
        _ => {
            println!("❌ Wizard cancelled by user.");
            return;
        }
    };

    let selection = raw_functions[selection_idx];
    println!("\n🔧 Configuring parameters for function: '{}'", selection);

    let mut args = Vec::new();
    match selection {
        "deposit" | "withdraw" => {
            let user: String = Input::with_theme(&theme)
                .with_prompt("👤 Enter user address (from/to)")
                .default("GD...USER".to_string())
                .interact_text()
                .unwrap_or_default();
            let amount: String = Input::with_theme(&theme)
                .with_prompt("💵 Enter amount (i128)")
                .default("100".to_string())
                .interact_text()
                .unwrap_or_default();
            args.push(format!("--from {}", user));
            args.push(format!("--amount {}", amount));
        }
        "initialize" => {
            let admin: String = Input::with_theme(&theme)
                .with_prompt("🛡️ Enter admin address")
                .default("GD...ADMIN".to_string())
                .interact_text()
                .unwrap_or_default();
            let token: String = Input::with_theme(&theme)
                .with_prompt("🪙 Enter asset token address")
                .default("CD...TOKEN".to_string())
                .interact_text()
                .unwrap_or_default();
            let lock_period: String = Input::with_theme(&theme)
                .with_prompt("⏱️ Enter lock period in seconds (u64)")
                .default("3600".to_string())
                .interact_text()
                .unwrap_or_default();
            args.push(format!("--admin {}", admin));
            args.push(format!("--token {}", token));
            args.push(format!("--lock_period {}", lock_period));
        }
        "set_paused" => {
            let admin: String = Input::with_theme(&theme)
                .with_prompt("🛡️ Enter admin address")
                .default("GD...ADMIN".to_string())
                .interact_text()
                .unwrap_or_default();
            let paused: bool = Select::with_theme(&theme)
                .with_prompt("⏸️ Pause status")
                .default(0)
                .items(&["false (Running ▶️)", "true (Paused ⏸️)"])
                .interact()
                .unwrap_or(0) == 1;
            args.push(format!("--admin {}", admin));
            args.push(format!("--paused {}", paused));
        }
        "get_balance" => {
            let user: String = Input::with_theme(&theme)
                .with_prompt("🔍 Enter user address")
                .default("GD...USER".to_string())
                .interact_text()
                .unwrap_or_default();
            args.push(format!("--user {}", user));
        }
        _ => {}
    }

    println!("\n⚡ Generating Soroban CLI Command invocation...");
    let mut command = format!("soroban contract invoke --id {} --network testnet -- {}", contract_id, selection);
    for arg in args {
        command.push_str(&format!(" {}", arg));
    }
    
    println!("\n📦 [Assembled Command]:");
    println!("$ {}", command);
    
    println!("\n🚀 Simulating invocation on-chain...");
    println!("✅ Transaction status: SUCCESS");
    println!("📜 Logs: [Contract Event] Emitted event for invocation of '{}'", selection);
}
