import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Default setup to bundle flowr once
 */
export default async function setup(): Promise<void> {
	await execAsync('npm run build:bundle-flowr', { timeout: 6 * 60 * 1000 });
}
