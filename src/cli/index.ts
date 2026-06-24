#!/usr/bin/env node
import { Command } from 'commander';
import { runInit, scaffoldProject } from './init';

const program = new Command();

program
  .name('sharif-soroban')
  .description('CLI tools for Soroban smart contracts')
  .version('1.0.0');

program
  .command('init')
  .description('Scaffold a basic Soroban smart contract directory structure')
  .argument('[project-name]', 'Name of the project')
  .option('-t, --template <type>', 'Template type (empty, hello-world, token)', 'hello-world')
  .option('-n, --network <type>', 'Network (testnet, standalone)', 'testnet')
  .action(async (projectName, options) => {
    if (projectName) {
      // Direct scaffolding if project name is provided
      scaffoldProject({
        projectName,
        templateType: options.template as any,
        network: options.network as any,
      });
    } else {
      // Interactive mode if no project name is provided
      await runInit();
    }
  });

program.parse();
