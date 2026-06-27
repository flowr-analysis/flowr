import { beforeAll, assert, describe, test } from 'vitest';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const flowrBin = 'node dist/src/cli/flowr.min.js';

const enum WatchState  { AwaitPrompt, AwaitWatch, AwaitRerun }
const enum CtrlCState  { AwaitPrompt, AwaitHint,  AwaitExit  }

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
		const child = exec(flowrBin, { timeout: timeout + 5_000 });
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
		const child = exec(flowrBin, { timeout: timeout + 5_000 });
		let buffer = '';
		let state = WatchState.AwaitPrompt;

		child.stdout?.on('data', (d: Buffer) => {
			buffer += d.toString();
			if(state === WatchState.AwaitPrompt && buffer.includes('R>')) {
				state = WatchState.AwaitWatch;
				child.stdin?.write(`${command}\n`);
			} else if(state === WatchState.AwaitWatch && buffer.includes('Watching')) {
				state = WatchState.AwaitRerun;
				// small delay to ensure the watcher is set up before we write
				setTimeout(() => {
					fs.writeFileSync(filePath, newContent);
				}, 200);
			} else if(state === WatchState.AwaitRerun && buffer.includes('Change detected')) {
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
		const child = exec(flowrBin, { timeout: timeout + 5_000 });
		let buffer = '';
		let state = CtrlCState.AwaitPrompt;

		child.stdout?.on('data', (d: Buffer) => {
			buffer += d.toString();
			if(state === CtrlCState.AwaitPrompt && buffer.includes('R>')) {
				state = CtrlCState.AwaitHint;
				child.stdin?.write('\x03');
			} else if(state === CtrlCState.AwaitHint && buffer.includes('Press Ctrl+C again')) {
				state = CtrlCState.AwaitExit;
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
	beforeAll(() => new Promise<void>((resolve, reject) => {
		exec('npm run build:bundle-flowr', { timeout: 120_000 }, err => err ? reject(err) : resolve());
	}), 120_000);

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
