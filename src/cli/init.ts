import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs';

export interface InitAnswers {
  projectName: string;
  templateType: 'empty' | 'hello-world' | 'token';
  network: 'testnet' | 'standalone';
}

export async function promptInit(): Promise<InitAnswers> {
  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      validate: (input: string) => input.trim().length > 0 || 'Project name cannot be empty',
    },
    {
      type: 'list',
      name: 'templateType',
      message: 'Template type:',
      choices: ['empty', 'hello-world', 'token'],
      default: 'hello-world',
    },
    {
      type: 'list',
      name: 'network',
      message: 'Network:',
      choices: ['testnet', 'standalone'],
      default: 'testnet',
    },
  ]);
  return answers;
}

export function scaffoldProject(answers: InitAnswers, baseDir = process.cwd()): string {
  const projectDir = path.join(baseDir, answers.projectName);

  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Create directory structure
  const srcDir = path.join(projectDir, 'src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  // Write Cargo.toml
  const cargoToml = `[package]
name = "${answers.projectName}"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "20", features = ["alloc"] }
`;
  fs.writeFileSync(path.join(projectDir, 'Cargo.toml'), cargoToml);

  // Write lib.rs based on template
  let libRs = '';
  if (answers.templateType === 'hello-world') {
    libRs = `#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
`;
  } else if (answers.templateType === 'token') {
    libRs = `#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Address, Symbol};

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn balance(env: Env, addr: Address) -> u128 {
        0 // Mock implementation
    }
}
`;
  } else {
    libRs = `#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn init(env: Env) {
    }
}
`;
  }
  fs.writeFileSync(path.join(srcDir, 'lib.rs'), libRs);

  const config = {
    projectName: answers.projectName,
    templateType: answers.templateType,
    network: answers.network,
  };

  fs.writeFileSync(path.join(projectDir, 'soroban.config.json'), JSON.stringify(config, null, 2));

  console.log(`\nProject "${answers.projectName}" scaffolded at ${projectDir}`);
  console.log(`  Template : ${answers.templateType}`);
  console.log(`  Network  : ${answers.network}`);

  return projectDir;
}

export async function runInit(): Promise<void> {
  const answers = await promptInit();
  scaffoldProject(answers);
}