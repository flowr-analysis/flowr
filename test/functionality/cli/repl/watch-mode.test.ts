import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import {
	toFileStatement,
	extractWatchPath,
	startWatching,
	stopWatching,
} from '../../../../src/cli/repl/core';
import { watchProtocol } from '../../../../src/cli/repl/path-input';
import { fileProtocol } from '../../../../src/r-bridge/retriever';
import type { ReplOutput } from '../../../../src/cli/repl/commands/repl-main';
import { formatter } from '../../../../src/util/text/ansi';

function makeOutput(): ReplOutput & { lines: string[] } {
	const lines: string[] = [];
	return { formatter, stdout: s => lines.push(s), stderr: s => lines.push(s), lines };
}

describe('watch-mode helpers', () => {
	test('toFileStatement replaces watch:// with file://', () => {
		expect(toFileStatement(`:df ${watchProtocol}/tmp/test.R`))
			.toBe(`:df ${fileProtocol}/tmp/test.R`);
		expect(toFileStatement(`:query @linter ${watchProtocol}/some/folder`))
			.toBe(`:query @linter ${fileProtocol}/some/folder`);
		expect(toFileStatement(':df file://no-watch.R'))
			.toBe(':df file://no-watch.R');
	});

	test('extractWatchPath returns path after watch://', () => {
		expect(extractWatchPath(`:df ${watchProtocol}/tmp/test.R`)).toBe('/tmp/test.R');
		expect(extractWatchPath(`:df ${watchProtocol}relative/path.R`)).toBe('relative/path.R');
		expect(extractWatchPath(':df file://no-watch.R')).toBeUndefined();
	});

	describe('faked file changes via startWatching', () => {
		beforeEach(() => {
			vi.spyOn(fs, 'existsSync').mockReturnValue(true);
			vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => false } as unknown as fs.Stats);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		test('faked changes trigger onFire each time', () => {
			vi.useFakeTimers();
			let storedCb: (() => void) | undefined;
			const closeFn = vi.fn();
			const fakeWatch = vi.fn((_p: fs.PathLike, _o: object, cb: fs.WatchListener<string>) => {
				storedCb = cb as (() => void);
				return { close: closeFn } as unknown as fs.FSWatcher;
			}) as unknown as typeof fs.watch;

			const output = makeOutput();
			const fireCount = { n: 0 };
			startWatching('/tmp/test.R', output, () => {
				fireCount.n++;
			}, fakeWatch);

			expect(fireCount.n).toBe(0);
			storedCb?.();
			vi.advanceTimersByTime(100);
			expect(fireCount.n).toBe(1);
			storedCb?.();
			vi.advanceTimersByTime(100);
			expect(fireCount.n).toBe(2);
			expect(output.lines.find(l => l.includes("Watching file '/tmp/test.R'. Press Ctrl+C"))).toBeDefined();
			vi.useRealTimers();
		});

		test('startWatching uses "folder" label when path is a directory', () => {
			vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as unknown as fs.Stats);
			const fakeWatch = vi.fn(() => ({ close: vi.fn() }) as unknown as fs.FSWatcher) as unknown as typeof fs.watch;

			const output = makeOutput();
			startWatching('/some/dir', output, vi.fn(), fakeWatch);
			expect(output.lines[0]).toContain("Watching folder '/some/dir'");
		});

		test('stopWatching with no active watcher prints nothing', () => {
			const output = makeOutput();
			const before = output.lines.length;
			stopWatching(output);
			expect(output.lines.length).toBe(before);
		});
	});
});
