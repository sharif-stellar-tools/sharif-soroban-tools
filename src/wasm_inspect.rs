use wasmparser::{Parser, Payload, TypeRef, ExternalKind, CompositeType};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct ExportedFn {
    pub name: String,
    pub params: Vec<String>,
    pub results: Vec<String>,
}

pub fn extract_exports(wasm_bytes: &[u8]) -> Result<Vec<ExportedFn>, String> {
    let mut types = Vec::new();
    let mut imported_funcs = Vec::new();
    let mut defined_funcs = Vec::new();
    let mut exports = Vec::new();

    let parser = Parser::new(0);
    for payload in parser.parse_all(wasm_bytes) {
        let payload = payload.map_err(|e| format!("Failed to parse WASM payload: {}", e))?;
        match payload {
            Payload::TypeSection(reader) => {
                for entry in reader {
                    let rec_group = entry.map_err(|e| format!("Failed to read type: {}", e))?;
                    for sub_type in rec_group.types() {
                        types.push(sub_type.clone());
                    }
                }
            }
            Payload::ImportSection(reader) => {
                for entry in reader {
                    let import = entry.map_err(|e| format!("Failed to read import: {}", e))?;
                    if let TypeRef::Func(type_idx) = import.ty {
                        imported_funcs.push(type_idx);
                    }
                }
            }
            Payload::FunctionSection(reader) => {
                for entry in reader {
                    let type_idx = entry.map_err(|e| format!("Failed to read function: {}", e))?;
                    defined_funcs.push(type_idx);
                }
            }
            Payload::ExportSection(reader) => {
                for entry in reader {
                    let export = entry.map_err(|e| format!("Failed to read export: {}", e))?;
                    if export.kind == ExternalKind::Func {
                        exports.push((export.name.to_string(), export.index));
                    }
                }
            }
            _ => {}
        }
    }

    // Build function index space (imported functions first, then defined functions)
    let mut func_types = Vec::new();
    func_types.extend(imported_funcs);
    func_types.extend(defined_funcs);

    let mut result = Vec::new();
    for (name, func_idx) in exports {
        let func_idx = func_idx as usize;
        if func_idx < func_types.len() {
            let type_idx = func_types[func_idx] as usize;
            if type_idx < types.len() {
                if let CompositeType::Func(func_type) = &types[type_idx].composite_type {
                    let params = func_type
                        .params()
                        .iter()
                        .map(|p| format!("{:?}", p).to_lowercase())
                        .collect();
                    let results = func_type
                        .results()
                        .iter()
                        .map(|r| format!("{:?}", r).to_lowercase())
                        .collect();
                    result.push(ExportedFn {
                        name,
                        params,
                        results,
                    });
                }
            }
        }
    }

    Ok(result)
}