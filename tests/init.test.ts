import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { scaffoldProject, InitAnswers } from '../src/cli/init';

// Mock inquirer so tests run without interactive TTY
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

const answers = (overrides: Partial<InitAnswers> = {}): InitAnswers => ({
  projectName: 'my-soroban-app',
  templateType: 'hello-world',
  network: 'testnet',
  ...overrides,
});

describe('scaffoldProject', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soroban-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates the project directory', () => {
    scaffoldProject(answers(), tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'my-soroban-app'))).toBe(true);
  });

  it('writes soroban.config.json with correct values', () => {
    scaffoldProject(answers(), tmpDir);
    const configPath = path.join(tmpDir, 'my-soroban-app', 'soroban.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.projectName).toBe('my-soroban-app');
    expect(config.templateType).toBe('hello-world');
    expect(config.network).toBe('testnet');
  });

  it('returns the created project directory path', () => {
    const result = scaffoldProject(answers(), tmpDir);
    expect(result).toBe(path.join(tmpDir, 'my-soroban-app'));
  });

  it('scaffolds with token template on standalone network', () => {
    scaffoldProject(answers({ templateType: 'token', network: 'standalone' }), tmpDir);
    const configPath = path.join(tmpDir, 'my-soroban-app', 'soroban.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.templateType).toBe('token');
    expect(config.network).toBe('standalone');
  });

  it('scaffolds with empty template', () => {
    scaffoldProject(answers({ projectName: 'empty-project', templateType: 'empty' }), tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'empty-project'))).toBe(true);
  });

  it('does not throw if project directory already exists', () => {
    fs.mkdirSync(path.join(tmpDir, 'my-soroban-app'));
    expect(() => scaffoldProject(answers(), tmpDir)).not.toThrow();
  });
});