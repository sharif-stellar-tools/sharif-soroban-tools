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