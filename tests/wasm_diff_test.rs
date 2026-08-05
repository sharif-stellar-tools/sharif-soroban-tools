use std::fs;
use sharif_soroban_tools::{wasm_inspect, diff};

#[test]
fn test_wasm_diff_exports() {
    // 1. Load WASM bytes from compiled fixtures
    let wasm_v1 = fs::read("tests/fixtures/v1.wasm")
        .expect("Failed to read v1.wasm");
    let wasm_v2 = fs::read("tests/fixtures/v2.wasm")
        .expect("Failed to read v2.wasm");

    // 2. Extract exports
    let exports_v1 = wasm_inspect::extract_exports(&wasm_v1)
        .expect("Failed to extract exports from v1.wasm");
    let exports_v2 = wasm_inspect::extract_exports(&wasm_v2)
        .expect("Failed to extract exports from v2.wasm");

    // Check extracted exports of v1
    assert_eq!(exports_v1.len(), 2);
    assert_eq!(exports_v1[0].name, "hello");
    assert_eq!(exports_v1[0].params, vec!["i64"]);
    assert_eq!(exports_v1[0].results, vec!["i64"]);

    assert_eq!(exports_v1[1].name, "add");
    assert_eq!(exports_v1[1].params, vec!["i64", "i64"]);
    assert_eq!(exports_v1[1].results, vec!["i64"]);

    // Check extracted exports of v2
    assert_eq!(exports_v2.len(), 2);
    assert_eq!(exports_v2[0].name, "add");
    assert_eq!(exports_v2[0].params, vec!["i64", "i64", "i64"]);
    assert_eq!(exports_v2[0].results, vec!["i64"]);

    assert_eq!(exports_v2[1].name, "subtract");
    assert_eq!(exports_v2[1].params, vec!["i64", "i64"]);
    assert_eq!(exports_v2[1].results, vec!["i64"]);

    // 3. Compute diffs
    let diffs = diff::diff_exports(&exports_v1, &exports_v2);

    // Diffs should sort alphabetically by function name: "add", "hello", "subtract"
    assert_eq!(diffs.len(), 3);

    // "add" changed
    assert_eq!(diffs[0].name, "add");
    assert_eq!(
        diffs[0].kind,
        diff::DiffKind::Changed {
            v1_sig: "fn add(i64, i64) -> i64".to_string(),
            v2_sig: "fn add(i64, i64, i64) -> i64".to_string(),
        }
    );

    // "hello" removed
    assert_eq!(diffs[1].name, "hello");
    assert_eq!(diffs[1].kind, diff::DiffKind::Removed);

    // "subtract" added
    assert_eq!(diffs[2].name, "subtract");
    assert_eq!(diffs[2].kind, diff::DiffKind::Added);
}