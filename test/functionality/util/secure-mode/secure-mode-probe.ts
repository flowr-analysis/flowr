/*
 * Run in its own process (with FLOWR_SECURE_MODE=1) by secure-mode.test.ts, as the secure mode cannot be disabled once on.
 * Prints one JSON object naming the outcome of every probe.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SecureMode, SecureModeError } from '../../../../src/util/secure-mode';
import { RShellExecutor } from '../../../../src/r-bridge/shell-executor';
import { RShell } from '../../../../src/r-bridge/shell';
import { waitOnScript } from '../../../../src/cli/repl/execute';
import { FlowrConfig } from '../../../../src/config';
import { retrieveEngineInstances } from '../../../../src/engines';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { RDAParser } from '../../../../src/project/plugins/file-plugins/files/flowr-rda-file';
import type { FlowrFileProvider } from '../../../../src/project/context/flowr-file';
import { executeLintingRule } from '../../../../src/linter/linter-executor';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

/** writes 600 MB of zeros, gzip-compressed, to `file` without holding them in memory */
async function writeGzipBomb(file: string): Promise<void> {
	const zeros = Buffer.alloc(1024 * 1024);
	await pipeline(Readable.from((function*() {
		for(let i = 0; i < 600; i++) {
			yield zeros;
		}
	})()), zlib.createGzip({ level: 9 }), fs.createWriteStream(file));
}

function decompressOutcome(file: string): string {
	try {
		new RDAParser({ path: () => file } as unknown as FlowrFileProvider).parseObject();
		return 'ok';
	} catch(e) {
		return e instanceof RangeError ? 'bounded' : `failed: ${(e as Error).message}`;
	}
}

async function outcome(f: () => unknown): Promise<string> {
	try {
		await f();
		return 'ok';
	} catch(e) {
		return e instanceof SecureModeError ? `refused: ${e.operation}` : `failed: ${(e as Error).message}`;
	}
}

void (async() => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-secure-'));
	const hostile = JSON.stringify({ engines: [{ type: 'r-shell', rPath: '/tmp/evil.sh' }], defaultEngine: 'r-shell' });
	fs.writeFileSync(path.join(dir, 'flowr.json'), hostile);
	const rPathOf = (c: FlowrConfig | undefined) => (c?.engines.find(e => e.type === 'r-shell') as { rPath?: string } | undefined)?.rPath;

	process.env[SecureMode.EnvVar] = '0';
	const engines = await retrieveEngineInstances(FlowrConfig.parse(hostile) as FlowrConfig);
	const analyzer = await new FlowrAnalyzerBuilder().setParser(engines.engines[engines.default] as never).build();
	analyzer.addRequest(requestFromInput('x <- 1\nprint(x)'));

	const gz = path.join(dir, 'bomb.rda');
	await writeGzipBomb(gz);
	const regexConfig = FlowrConfig.parse(JSON.stringify({
		project: { classification: { shinyUsagePattern: '(a+)+$' } },
		solver:  { resolveSource: { applyReplacements: [{ '(a+)+$': 'x' }] } }
	}));
	const lint = await executeLintingRule('absolute-file-paths', analyzer, { absolutePathRegex: '(' });

	const result = {
		enabled:        SecureMode.isEnabled(),
		noDisable:      !Object.keys(SecureMode).some(k => /disable|toggle|set|reset/i.test(k)),
		rShellExecutor: await outcome(() => new RShellExecutor().run('1')),
		rShell:         await outcome(() => new RShell().sendCommandWithOutput('1')),
		fork:           await outcome(() => waitOnScript(path.join(dir, 'x.js'), [])),
		parsedRPath:    rPathOf(FlowrConfig.parse(hostile)) ?? null,
		absoluteRPath:  rPathOf(FlowrConfig.fromFile(path.join(dir, 'flowr.json'))) ?? null,
		searchedRPath:  rPathOf(FlowrConfig.fromFile('flowr.json', dir, true)) ?? null,
		gzipBomb:       decompressOutcome(gz),
		regexConfig:    regexConfig?.project.classification?.shinyUsagePattern === FlowrConfig.default().project.classification?.shinyUsagePattern
			&& JSON.stringify(regexConfig?.solver.resolveSource?.applyReplacements) === JSON.stringify(FlowrConfig.default().solver.resolveSource?.applyReplacements),
		lintRegexIgnored: !('error' in lint),
		engines:          Object.keys(engines.engines),
		defaultEngine:    engines.default,
		analysis:         await outcome(async() => (await analyzer.dataflow()).graph.vertices(true).toArray().length > 0 || (() => {
			throw new Error('empty graph');
		})())
	};
	fs.rmSync(dir, { recursive: true, force: true });
	console.log(JSON.stringify(result));
	process.exit(0);
})();
