import { beforeAll, assert, describe, test } from 'vitest';
import type { ChildProcess } from 'child_process';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const flowrBin = 'node dist/src/cli/flowr.min.js';

const enum WatchState  { AwaitPrompt, AwaitWatch, AwaitRerun }
const enum CtrlCState  { AwaitPrompt, AwaitHint,  AwaitExit  }

/** Reject if the spawned process dies before the expected output was seen, so we fail fast instead of timing out. */
function rejectOnEarlyExit(child: ChildProcess, getBuffer: () => string, reject: (e: Error) => void): void {
	child.on('exit', code => reject(new Error(`flowr exited early (code ${code ?? 'null'}) before completing:\n${getBuffer()}`)));
	child.on('error', e => reject(e));
}

/**
 * Spawn the flowr REPL, send `command` when the first prompt appears,
 * and return the accumulated output once `terminateOn` appears in stdout
 * (or `timeout` ms elapses, which rejects).
 */
function flowrReplUntil(command: string, terminateOn: string, timeout = 90_000): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		let done = false;
		const finish = (fn: () => void) => {
			if(!done){
				done = true; clearTimeout(timer); fn();
			}
		};
		const timer = setTimeout(() => finish(() => {
			child.kill('SIGKILL'); reject(new Error(`timed out waiting for '${terminateOn}':\n${buffer}`));
		}), timeout);
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
				finish(() => {
					child.stdin?.write(':quit\n');
					setTimeout(() => {
						child.kill('SIGKILL'); resolve(buffer);
					}, 500);
				});
			}
		});
		rejectOnEarlyExit(child, () => buffer, e => finish(() => reject(e)));
	});
}

/**
 * Spawn the flowr REPL, send a watch command, wait for the 'Watching' signal,
 * repeatedly touch `filePath` until 'Change detected' appears in the output.
 * The repeated writes make the test robust against a single `fs.watch` event being dropped under load.
 */
function flowrReplWatchAndChange(command: string, filePath: string, contents: readonly string[], timeout = 90_000): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		let done = false;
		let writer: ReturnType<typeof setInterval> | undefined;
		const finish = (fn: () => void) => {
			if(!done){
				done = true; clearTimeout(timer); clearInterval(writer); fn();
			}
		};
		const timer = setTimeout(() => finish(() => {
			child.kill('SIGKILL'); reject(new Error(`watch test timed out:\n${buffer}`));
		}), timeout);
		const child = exec(flowrBin, { timeout: timeout + 5_000 });
		let buffer = '';
		let state = WatchState.AwaitPrompt;
		let i = 0;

		child.stdout?.on('data', (d: Buffer) => {
			buffer += d.toString();
			if(state === WatchState.AwaitPrompt && buffer.includes('R>')) {
				state = WatchState.AwaitWatch;
				child.stdin?.write(`${command}\n`);
			} else if(state === WatchState.AwaitWatch && buffer.includes('Watching')) {
				state = WatchState.AwaitRerun;
				// keep changing the file until the watcher fires, alternating contents so every write is a real change
				writer = setInterval(() => fs.writeFileSync(filePath, contents[i++ % contents.length]), 500);
			} else if(state === WatchState.AwaitRerun && buffer.includes('Change detected')) {
				finish(() => {
					child.stdin?.write(':quit\n');
					setTimeout(() => {
						child.kill('SIGKILL'); resolve(buffer);
					}, 500);
				});
			}
		});
		rejectOnEarlyExit(child, () => buffer, e => finish(() => reject(e)));
	});
}

/**
 * Spawn the flowr REPL, send two Ctrl+C characters (with a small delay between them),
 * and resolve with the accumulated output once the process exits.
 */
function flowrReplDoubleCtrlC(timeout = 90_000): Promise<string> {
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

describe.sequential('repl watch mode', () => {
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
				['b <- 2\n', 'c <- 3\n']
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
