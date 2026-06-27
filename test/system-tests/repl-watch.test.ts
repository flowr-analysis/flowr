import { assert, describe, test } from 'vitest';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Spawn the flowr REPL, send `command` when the first prompt appears,
 * and return the accumulated output once `terminateOn` appears in stdout
 * (or `timeout` ms elapses, which rejects).
 */
function flowrReplUntil(command: string, terminateOn: string, timeout = 60_000): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const timer = setTimeout(() => {
			child.kill('SIGKILL'); reject(new Error(`timed out waiting for '${terminateOn}'`));
		}, timeout);
		const child = exec('npm run flowr', { timeout: timeout + 5_000 });
		let buffer = '';
		let sent = false;

		child.stdout?.on('data', (d: Buffer) => {
			buffer += d.toString();
			if(!sent && buffer.includes('R>')) {
				sent = true;
				child.stdin?.write(`${command}\n`);
			}
			if(buffer.includes(terminateOn)) {
				clearTimeout(timer);
				child.stdin?.write(':quit\n');
				setTimeout(() => {
					child.kill('SIGKILL'); resolve(buffer);
				}, 500);
			}
		});

		child.on('error', (e) => {
			clearTimeout(timer); reject(e);
		});
	});
}

/**
 * Spawn the flowr REPL, send a watch command, wait for the 'Watching' signal,
 * write `newContent` to `filePath`, then wait for 'Change detected' in output.
 */
function flowrReplWatchAndChange(command: string, filePath: string, newContent: string, timeout = 60_000): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const timer = setTimeout(() => {
			child.kill('SIGKILL'); reject(new Error('watch test timed out'));
		}, timeout);
		const child = exec('npm run flowr', { timeout: timeout + 5_000 });
		let buffer = '';
		let state: 'await-prompt' | 'await-watch' | 'await-rerun' = 'await-prompt';

		child.stdout?.on('data', (d: Buffer) => {
			buffer += d.toString();
			if(state === 'await-prompt' && buffer.includes('R>')) {
				state = 'await-watch';
				child.stdin?.write(`${command}\n`);
			} else if(state === 'await-watch' && buffer.includes('Watching')) {
				state = 'await-rerun';
				// small delay to ensure the watcher is set up before we write
				setTimeout(() => {
					fs.writeFileSync(filePath, newContent);
				}, 200);
			} else if(state === 'await-rerun' && buffer.includes('Change detected')) {
				clearTimeout(timer);
				child.stdin?.write(':quit\n');
				setTimeout(() => {
					child.kill('SIGKILL'); resolve(buffer);
				}, 500);
			}
		});

		child.on('error', (e) => {
			clearTimeout(timer); reject(e);
		});
	});
}

/**
 * Spawn the flowr REPL, send two Ctrl+C characters (with a small delay between them),
 * and resolve with the accumulated output once the process exits.
 */
function flowrReplDoubleCtrlC(timeout = 60_000): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const timer = setTimeout(() => {
			child.kill('SIGKILL'); reject(new Error('double Ctrl+C test timed out'));
		}, timeout);
		const child = exec('npm run flowr', { timeout: timeout + 5_000 });
		let buffer = '';
		let state: 'await-prompt' | 'await-hint' | 'await-exit' = 'await-prompt';

		child.stdout?.on('data', (d: Buffer) => {
			buffer += d.toString();
			if(state === 'await-prompt' && buffer.includes('R>')) {
				state = 'await-hint';
				child.stdin?.write('\x03');
			} else if(state === 'await-hint' && buffer.includes('Press Ctrl+C again')) {
				state = 'await-exit';
				setTimeout(() => child.stdin?.write('\x03'), 200);
			}
		});

		child.on('exit', () => {
			clearTimeout(timer);
			resolve(buffer);
		});

		child.on('error', (e) => {
			clearTimeout(timer); reject(e);
		});
	});
}

describe('repl watch mode', () => {
	test('double Ctrl+C exits the REPL', async() => {
		const output = await flowrReplDoubleCtrlC();
		assert.include(output, 'Press Ctrl+C again', `hint message missing:\n${output}`);
	});

	test('watch:// file triggers Watching message on start', async() => {
		const tmpFile = path.join(os.tmpdir(), `flowr-watch-${Date.now()}.R`);
		fs.writeFileSync(tmpFile, 'x <- 1\n');
		try {
			const output = await flowrReplUntil(`:df watch://${tmpFile}`, 'Watching');
			assert.include(output, 'Watching', `expected 'Watching' in output:\n${output}`);
			assert.include(output, tmpFile, `expected file path in output:\n${output}`);
		} finally {
			if(fs.existsSync(tmpFile)) {
				fs.rmSync(tmpFile);
			}
		}
	});

	test('watch:// file re-runs command on file change', async() => {
		const tmpFile = path.join(os.tmpdir(), `flowr-watch-change-${Date.now()}.R`);
		fs.writeFileSync(tmpFile, 'a <- 1\n');
		try {
			const output = await flowrReplWatchAndChange(
				`:df watch://${tmpFile}`,
				tmpFile,
				'b <- 2\n'
			);
			assert.include(output, 'Watching', `watch signal missing:\n${output}`);
			assert.include(output, 'Change detected', `re-run signal missing:\n${output}`);
		} finally {
			if(fs.existsSync(tmpFile)) {
				fs.rmSync(tmpFile);
			}
		}
	});
});
