import { exec } from 'child_process';

/**
 * Default setup to bundle flowr once
 */
export default function setup(): Promise<void> {
	return new Promise((resolve, reject) => {
		exec('npm run build:bundle-flowr', { timeout: 6 * 60 * 1000 }, err => err ? reject(err) : resolve());
	});
}
