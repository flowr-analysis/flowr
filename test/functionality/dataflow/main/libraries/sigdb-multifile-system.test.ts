import { describe, expect, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { SigDbBuilder, SigDatabase, writeSignatureDb, SigDbExt, FnProp } from '../../../../../src/project/plugins/package-version-plugins/sigdb';
import { executeLintingRule } from '../../../../../src/linter/linter-executor';
import { LintingResults } from '../../../../../src/linter/linter-format';
import { isFunctionCallVertex } from '../../../../../src/dataflow/graph/vertex';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';

/**
 * A two-library database with real per-function detail: signatures (parameters with defaults/missing),
 * call graphs, and definition locations (file + line) -- everything a consumer needs to reason about a call.
 */
async function buildLibs(dir: string): Promise<SigDatabase> {
	const b = new SigDbBuilder();
	b.addPackage('greeter', { latest: '1.0.0', downloads: 9 });
	b.addVersion('greeter', '1.0.0', { cran:      true, functions: [
		{ name:   'greet', props:  FnProp.Exported, params: [
			{ name: 'who', missing: true },
			{ name: 'punct', default: '"!"' }
		], callees: ['paste'], file: 'R/greet.R', line: 2 }
	] });
	b.addPackage('mather', { latest: '2.0.0', downloads: 4 });
	b.addVersion('mather', '2.0.0', { cran:      true, functions: [
		{ name: 'add', props: FnProp.Exported, params: [{ name: 'a' }, { name: 'b', default: '0' }], callees: [], file: 'R/add.R', line: 5 }
	] });
	await writeSignatureDb(path.join(dir, 'db'), b.build({ date: '2026-05-23', generated: 0 }));
	return SigDatabase.open(path.join(dir, `db${SigDbExt}`));
}

describe('sigdb system: multi-file, multi-library project', withTreeSitter(ts => {
	async function analyzeProject(db: SigDatabase) {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
			.unregisterPlugins(SigDbPluginName).registerPlugins(new FlowrAnalyzerPackageVersionsSigDbPlugin(db)).build();
		// a second file that loads `mather` and wraps `add`, sourced by the main file (a genuine multi-file project)
		analyzer.addFile(new FlowrInlineTextFile('lib.R', 'library(mather)\nhelper_add <- function(a, b) add(a, b)\n'));
		analyzer.addRequest('source("lib.R")\nlibrary(greeter)\ngreet("bob")\nhelper_add(1, 2)\nnotdefined()');
		return analyzer;
	}

	test('undefined-symbol linter resolves the library + cross-file calls and flags only the truly undefined one', async() => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigdb-mf-'));
		const analyzer = await analyzeProject(await buildLibs(dir));
		const result = LintingResults.unpackSuccess(await executeLintingRule('undefined-symbol', analyzer, { checkVariables: false }));
		const flagged = result.results.map(r => r.name);
		expect(flagged).toContain('notdefined');       // genuinely undefined -> flagged
		expect(flagged).not.toContain('greet');         // resolved from greeter (sigdb)
		expect(flagged).not.toContain('add');           // resolved from mather (loaded in the sourced file)
		expect(flagged).not.toContain('helper_add');    // resolved from the cross-file definition
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test('the sigdb yields the definition location of a library function', async() => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigdb-mf-'));
		const db = await buildLibs(dir);
		// via the rich per-function view...
		const greet = (db.functions('greeter') ?? []).find(f => f.name === 'greet');
		expect(greet?.file).toBe('R/greet.R');
		expect(greet?.line).toBe(2);
		// ...and via the export view's location map (what `library()`-resolution consumers see)
		expect(db.lookup('greeter')?.locations?.get('greet')).toEqual({ file: 'R/greet.R', line: 2 });
		expect(db.lookup('mather')?.locations?.get('add')).toEqual({ file: 'R/add.R', line: 5 });
		db.close();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test('a call in the project can be matched against the signature the sigdb records for its definition', async() => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigdb-mf-'));
		const db = await buildLibs(dir);
		const analyzer = await analyzeProject(db);
		const dfg = (await analyzer.dataflow()).graph;

		const greetSig = (db.functions('greeter') ?? []).find(f => f.name === 'greet')?.signature ?? [];
		expect(greetSig.map(p => p.name)).toEqual(['who', 'punct']);
		expect(greetSig[0]).toMatchObject({ name: 'who', optional: false });         // `who` has no default (required)
		expect(greetSig[1]).toMatchObject({ name: 'punct', optional: true, default: '"!"' });

		// find the actual `greet("bob")` call and match its arguments against that recorded signature
		let greetCall: { args: readonly unknown[] } | undefined;
		for(const [, v] of dfg.vertices(true)) {
			if(isFunctionCallVertex(v) && Identifier.getName(v.name) === 'greet') {
				greetCall = v;
			}
		}
		expect(greetCall).toBeDefined();
		const argc = greetCall?.args.length ?? 0;
		expect(argc).toBe(1);                          // one positional argument: "bob"
		expect(argc).toBeLessThanOrEqual(greetSig.length);   // within arity
		// the single positional argument binds to the first (required) parameter of the recorded signature
		expect(greetSig[0].name).toBe('who');
		db.close();
		fs.rmSync(dir, { recursive: true, force: true });
	});
}));
