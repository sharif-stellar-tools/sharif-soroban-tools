use stellar_xdr::curr::{
    LedgerKey, LedgerKeyContractData, ScAddress, ScVal,
    ContractDataDurability, Hash, LedgerKeyContractCode,
    LedgerEntryData, ContractExecutable, Limits,
    WriteXdr, ReadXdr
};

pub fn rpc_url(network: &str) -> &str {
    match network {
        "testnet" => "https://soroban-testnet.stellar.org",
        "localnet" => "http://localhost:8000/soroban/rpc",
        _ => network, // Allow custom URL
    }
}

fn hex_to_bytes(hex: &str) -> Result<[u8; 32], String> {
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    if hex.len() != 64 {
        return Err(format!(
            "Invalid contract ID length: expected 64 hex chars, got {}",
            hex.len()
        ));
    }
    let mut bytes = [0u8; 32];
    for i in 0..32 {
        bytes[i] = u8::from_str_radix(&hex[2 * i..2 * i + 2], 16)
            .map_err(|e| format!("Invalid hex character at position {}: {}", 2 * i, e))?;
    }
    Ok(bytes)
}

pub async fn fetch_contract_wasm(contract_id: &str, network: &str) -> Result<Vec<u8>, String> {
    let contract_bytes = hex_to_bytes(contract_id)?;
    let sc_address = ScAddress::Contract(Hash(contract_bytes));
    
    // Build the LedgerKey for the contract instance
    let instance_key = LedgerKey::ContractData(LedgerKeyContractData {
        contract: sc_address,
        key: ScVal::LedgerKeyContractInstance,
        durability: ContractDataDurability::Persistent,
    });
    
    let instance_key_b64 = instance_key.to_xdr_base64(Limits::none()).map_err(|e| e.to_string())?;
    
    let client = reqwest::Client::new();
    let url = rpc_url(network);
    
    // 1. Fetch Contract Instance
    let payload = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getLedgerEntries",
        "params": {
            "keys": [instance_key_b64]
        }
    });
    
    let response = client.post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;
        
    let resp_json: serde_json::Value = response.json()
        .await
        .map_err(|e| format!("Failed to parse response JSON: {}", e))?;
        
    if let Some(error) = resp_json.get("error") {
        return Err(format!("RPC error fetching instance: {}", error));
    }
    
    let entries = resp_json.get("result")
        .and_then(|r| r.get("entries"))
        .and_then(|e| e.as_array())
        .ok_or_else(|| "Invalid response format: 'result.entries' missing".to_string())?;
        
    if entries.is_empty() {
        return Err(format!("Contract ID {} not found on network {}", contract_id, network));
    }
    
    let entry_xdr_b64 = entries[0].get("xdr")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "Invalid response format: 'xdr' missing in entry".to_string())?;
        
    let entry_data = LedgerEntryData::from_xdr_base64(entry_xdr_b64, Limits::none())
        .map_err(|e| format!("Failed to deserialize LedgerEntryData XDR: {}", e))?;
        
    let contract_instance = match entry_data {
        LedgerEntryData::ContractData(entry) => {
            match entry.val {
                ScVal::ContractInstance(instance) => instance,
                _ => return Err("Expected ContractInstance in LedgerEntryData::ContractData".to_string()),
            }
        }
        _ => return Err("Expected ContractData ledger entry".to_string()),
    };
    
    let wasm_hash = match contract_instance.executable {
        ContractExecutable::Wasm(hash) => hash,
        _ => {
            return Err("Contract is not a WASM contract (e.g. it is a built-in asset)".to_string());
        }
    };
    
    // 2. Fetch WASM code using the hash
    let code_key = LedgerKey::ContractCode(LedgerKeyContractCode {
        hash: wasm_hash,
    });
    
    let code_key_b64 = code_key.to_xdr_base64(Limits::none()).map_err(|e| e.to_string())?;
    
    let payload_code = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "getLedgerEntries",
        "params": {
            "keys": [code_key_b64]
        }
    });
    
    let response_code = client.post(url)
        .json(&payload_code)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;
        
    let resp_code_json: serde_json::Value = response_code.json()
        .await
        .map_err(|e| format!("Failed to parse response JSON: {}", e))?;
        
    if let Some(error) = resp_code_json.get("error") {
        return Err(format!("RPC error fetching WASM code: {}", error));
    }
    
    let entries_code = resp_code_json.get("result")
        .and_then(|r| r.get("entries"))
        .and_then(|e| e.as_array())
        .ok_or_else(|| "Invalid response format: 'result.entries' missing".to_string())?;
        
    if entries_code.is_empty() {
        return Err("WASM code entry not found on ledger".to_string());
    }
    
    let code_xdr_b64 = entries_code[0].get("xdr")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "Invalid response format: 'xdr' missing in entry".to_string())?;
        
    let code_entry_data = LedgerEntryData::from_xdr_base64(code_xdr_b64, Limits::none())
        .map_err(|e| format!("Failed to deserialize ContractCode XDR: {}", e))?;
        
    let wasm_bytes = match code_entry_data {
        LedgerEntryData::ContractCode(code_entry) => {
            code_entry.code.to_vec()
        }
        _ => return Err("Expected ContractCode ledger entry".to_string()),
    };
    
    Ok(wasm_bytes)
}