use std::collections::HashMap;
use crate::wasm_inspect::ExportedFn;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum DiffKind {
    Added,
    Removed,
    Changed {
        v1_sig: String,
        v2_sig: String,
    },
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct DiffEntry {
    pub name: String,
    pub kind: DiffKind,
}

pub fn format_sig(func: &ExportedFn) -> String {
    let params = func.params.join(", ");
    let results = if func.results.is_empty() {
        "".to_string()
    } else if func.results.len() == 1 {
        format!(" -> {}", func.results[0])
    } else {
        format!(" -> ({})", func.results.join(", "))
    };
    format!("fn {}({}){}", func.name, params, results)
}

pub fn diff_exports(v1: &[ExportedFn], v2: &[ExportedFn]) -> Vec<DiffEntry> {
    let map_v1: HashMap<String, &ExportedFn> = v1.iter().map(|f| (f.name.clone(), f)).collect();
    let map_v2: HashMap<String, &ExportedFn> = v2.iter().map(|f| (f.name.clone(), f)).collect();
    
    let mut diffs = Vec::new();
    
    // Check for removed and changed
    for (name, f1) in &map_v1 {
        match map_v2.get(name) {
            None => {
                diffs.push(DiffEntry {
                    name: name.clone(),
                    kind: DiffKind::Removed,
                });
            }
            Some(f2) => {
                if f1.params != f2.params || f1.results != f2.results {
                    diffs.push(DiffEntry {
                        name: name.clone(),
                        kind: DiffKind::Changed {
                            v1_sig: format_sig(f1),
                            v2_sig: format_sig(f2),
                        },
                    });
                }
            }
        }
    }
    
    // Check for added
    for (name, _f2) in &map_v2 {
        if !map_v1.contains_key(name) {
            diffs.push(DiffEntry {
                name: name.clone(),
                kind: DiffKind::Added,
            });
        }
    }
    
    // Sort by function name to have a deterministic output order
    diffs.sort_by(|a, b| a.name.cmp(&b.name));
    
    diffs
}