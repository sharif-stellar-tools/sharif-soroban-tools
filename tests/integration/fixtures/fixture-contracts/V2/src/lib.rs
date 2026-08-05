#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn hello(_env: Env, greeting: u32) -> u32 {
        greeting
    }

    pub fn goodbye(_env: Env) -> u32 {
        0
    }
}