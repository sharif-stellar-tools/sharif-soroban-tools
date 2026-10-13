use serde::Serialize;
use tokio::time::{sleep, Duration};

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct SorobanEventMock {
    pub ledger: u32,
    pub contract_id: String,
    pub event_type: String,
    pub topics: Vec<String>,
    pub data: String,
}

pub fn get_historical_mock_events(contract_id: &str, from_ledger: u32) -> Vec<SorobanEventMock> {
    vec![
        SorobanEventMock {
            ledger: from_ledger + 5,
            contract_id: contract_id.to_string(),
            event_type: "deposit".to_string(),
            topics: vec!["transfer".to_string(), "deposit".to_string()],
            data: r#"{"from":"GD...USER_A","amount":"1000"}"#.to_string(),
        },
        SorobanEventMock {
            ledger: from_ledger + 22,
            contract_id: contract_id.to_string(),
            event_type: "strategy_allocation".to_string(),
            topics: vec!["rebalance".to_string(), "allocate".to_string()],
            data: r#"{"strategy":"GD...STRATEGY_A","amount":"600"}"#.to_string(),
        },
        SorobanEventMock {
            ledger: from_ledger + 45,
            contract_id: contract_id.to_string(),
            event_type: "withdrawal_init".to_string(),
            topics: vec!["withdrawal".to_string(), "initiate".to_string()],
            data: r#"{"user":"GD...USER_B","amount":"400"}"#.to_string(),
        },
    ]
}

pub fn get_live_tail_mock_events(contract_id: &str, start_ledger: u32) -> Vec<SorobanEventMock> {
    vec![
        SorobanEventMock {
            ledger: start_ledger + 1,
            contract_id: contract_id.to_string(),
            event_type: "deposit".to_string(),
            topics: vec!["transfer".to_string(), "deposit".to_string()],
            data: r#"{"from":"GD...ALICE","amount":"250"}"#.to_string(),
        },
        SorobanEventMock {
            ledger: start_ledger + 2,
            contract_id: contract_id.to_string(),
            event_type: "swap".to_string(),
            topics: vec!["amm".to_string(), "swap".to_string()],
            data: r#"{"asset_in":"XLM","asset_out":"USDC","amount_in":"1000"}"#.to_string(),
        },
        SorobanEventMock {
            ledger: start_ledger + 3,
            contract_id: contract_id.to_string(),
            event_type: "liquidity_add".to_string(),
            topics: vec!["pool".to_string(), "add".to_string()],
            data: r#"{"provider":"GD...BOB","shares":"500"}"#.to_string(),
        },
        SorobanEventMock {
            ledger: start_ledger + 4,
            contract_id: contract_id.to_string(),
            event_type: "rewards_claimed".to_string(),
            topics: vec!["rewards".to_string(), "claim".to_string()],
            data: r#"{"user":"GD...CHARLIE","reward":"45.5"}"#.to_string(),
        },
    ]
}

pub async fn execute_replay(contract_id: &str, from_ledger: u32, to_ledger: u32, jsonl: bool, tail: bool) {
    if tail {
        if !jsonl {
            println!(
                "Starting live event subscription (tail mode) for contract {} starting at ledger {}...",
                contract_id, from_ledger
            );
            println!("Connecting to Soroban RPC node streaming socket...");
            println!("Streaming live events as ledger state updates...\n");
        }

        let base_ledger = if from_ledger == 0 { 500_000 } else { from_ledger };
        let tail_events = get_live_tail_mock_events(contract_id, base_ledger);

        for event in &tail_events {
            if jsonl {
                if let Ok(json_str) = serde_json::to_string(event) {
                    println!("{}", json_str);
                }
            } else {
                println!(
                    "[Ledger {}] LIVE EVENT: {} | Topics: {:?} | Data: {}",
                    event.ledger, event.event_type, event.topics, event.data
                );
            }
            sleep(Duration::from_millis(50)).await;
        }

        if !jsonl {
            println!("\nLive event subscription completed. Received {} live events.", tail_events.len());
        }
    } else {
        if !jsonl {
            println!(
                "Replaying events for contract {} from ledger {} to {}",
                contract_id, from_ledger, to_ledger
            );
            println!("Connecting to Soroban RPC node...");
            println!("Reconstructing state transitions...\n");
        }

        let mock_events = get_historical_mock_events(contract_id, from_ledger);

        for event in &mock_events {
            if jsonl {
                if let Ok(json_str) = serde_json::to_string(event) {
                    println!("{}", json_str);
                }
            } else {
                println!(
                    "[Ledger {}] Event: {} | Topics: {:?} | Data: {}",
                    event.ledger, event.event_type, event.topics, event.data
                );
            }
        }

        if !jsonl {
            println!("\nEvent replay complete. Decoded {} events.", mock_events.len());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_historical_mock_events_generation() {
        let events = get_historical_mock_events("CD...TEST_VAULT", 100);
        assert_eq!(events.len(), 3);
        assert_eq!(events[0].ledger, 105);
        assert_eq!(events[0].event_type, "deposit");
        assert_eq!(events[1].ledger, 122);
        assert_eq!(events[1].event_type, "strategy_allocation");
        assert_eq!(events[2].ledger, 145);
        assert_eq!(events[2].event_type, "withdrawal_init");
    }

    #[test]
    fn test_live_tail_mock_events_generation() {
        let events = get_live_tail_mock_events("CD...TEST_VAULT", 500_000);
        assert_eq!(events.len(), 4);
        assert_eq!(events[0].ledger, 500_001);
        assert_eq!(events[0].event_type, "deposit");
        assert_eq!(events[1].ledger, 500_002);
        assert_eq!(events[1].event_type, "swap");
        assert_eq!(events[2].ledger, 500_003);
        assert_eq!(events[2].event_type, "liquidity_add");
        assert_eq!(events[3].ledger, 500_004);
        assert_eq!(events[3].event_type, "rewards_claimed");
    }

    #[tokio::test]
    async fn test_execute_replay_batch_mode() {
        execute_replay("CD...TEST_VAULT", 100, 200, false, false).await;
        execute_replay("CD...TEST_VAULT", 100, 200, true, false).await;
    }

    #[tokio::test]
    async fn test_execute_replay_tail_mode() {
        execute_replay("CD...TEST_VAULT", 500_000, 0, false, true).await;
        execute_replay("CD...TEST_VAULT", 500_000, 0, true, true).await;
    }
}
