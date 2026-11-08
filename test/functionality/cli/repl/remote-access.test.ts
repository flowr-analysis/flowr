import { assert, describe, expect, test } from 'vitest';
import { joinUntrustedSegment } from '../../../../src/util/files';
import path from 'path';
import { isAllowedWebSocketOrigin } from '../../../../src/cli/repl/server/net';
import { ensurePlain } from '../../../../src/project/sigdb/decompress';
import { getReplCommands } from '../../../../src/cli/repl/commands/repl-commands';
import { replProcessAnswer } from '../../../../src/cli/repl/core';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { discardingReplOutput } from '../../_helper/repl';
import { label } from '../../_helper/label';

/** Clients of the server are untrusted: they may analyze code, but not use commands that act beyond that. */
describe('Remote REPL access', () => {
	/*
	 * Every command has to be classified, so a new command is not handed to server clients by accident.
	 * Commands that spawn processes, write files, or change global state must be `localOnly`.
	 */
	test(label('every command is classified for remote access', ['name-normal'], ['other']), () => {
		const localOnly = ['benchmark', 'signature', 'slicer', 'summarizer'];
		const remote = [
			'controlflow', 'controlflow*', 'controlflowbb', 'controlflowbb*', 'dataflow', 'dataflow*', 'dataflowascii', 'dataflowsilent',
			'dataflowsimple', 'dataflowsimple*', 'execute', 'help', 'normalize', 'normalize#', 'normalize*', 'parse', 'query', 'query*', 'quit', 'version'
		];
		const commands = Object.entries(getReplCommands());
		assert.sameMembers(commands.filter(([, c]) => c.localOnly).map(([n]) => n), localOnly);
		assert.sameMembers(commands.filter(([, c]) => !c.localOnly).map(([n]) => n), remote);
	});

	async function run(expr: string, remote: boolean): Promise<string> {
		const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
		const err: string[] = [];
		await replProcessAnswer(analyzer, { ...discardingReplOutput, stderr: s => err.push(s) }, expr, false, remote);
		return err.join('\n');
	}

	test.each([':slicer --help', ':benchmark --help', ':signature download', ':sig add /etc/passwd'])(label('%s is refused for server clients', ['name-normal'], ['other']), async expr => {
		assert.include(await run(expr, true), 'only available in a local session');
	});

	test(label('a local session may still use them', ['name-normal'], ['other']), async() => {
		assert.notInclude(await run(':signature help', false), 'only available in a local session');
	});

	test(label('config queries cannot set security-sensitive options', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
		const result = await analyzer.query([{ type:   'config', update: {
			ignoreSourceCalls: true,
			engines:           [{ type: 'r-shell', rPath: '/tmp/evil.sh' }],
			solver:            { sigdb: { additionalPaths: ['/tmp/evil'] } }
		} }]);
		const config = result.config.config;
		assert.isTrue(config.ignoreSourceCalls, 'the harmless part applies');
		assert.notDeepInclude(config.engines, { type: 'r-shell', rPath: '/tmp/evil.sh' });
		assert.notInclude(config.solver.sigdb.additionalPaths ?? [], '/tmp/evil');
	});

	test.each(['..', '.', '', '../x', 'a/b', 'a\\b', '/etc/passwd', 'x\0y'])(label('joinUntrustedSegment refuses %j', ['name-normal'], ['other']), segment => {
		assert.throws(() => joinUntrustedSegment('/base', segment));
	});
	test(label('joinUntrustedSegment joins a plain name', ['name-normal'], ['other']), () => {
		assert.strictEqual(joinUntrustedSegment('/base', 'sigdb-v2.16.0'), path.join('/base', 'sigdb-v2.16.0'));
	});
	test(label('a signature database hash cannot leave the cache directory', ['name-normal'], ['other']), async() => {
		/* the hash may come from the header of a project-supplied bundle */
		for(const hash of ['../../evil', 'a/b']) {
			await expect(ensurePlain('/nonexistent/db.sigs.ndjson.br', { hash, cacheDir: '/nonexistent/cache' })).rejects.toThrow('untrusted path segment');
		}
	});
	test.each([
		[undefined, [], true], ['http://localhost:3000', [], true], ['http://127.0.0.1', [], true], ['http://[::1]:8080', [], true],
		['https://evil.example', [], false], ['https://localhost.evil.example', [], false], ['null', [], false],
		['https://ok.example', ['https://ok.example'], true], ['https://evil.example', ['https://ok.example'], false], ['https://any.example', ['*'], true]
	] as const)(label('websocket origin %j with allowed %j is allowed: %s', ['name-normal'], ['other']), (origin, allowed, expected) => {
		assert.strictEqual(isAllowedWebSocketOrigin(origin, allowed), expected);
	});
});
