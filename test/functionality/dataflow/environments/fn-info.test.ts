import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { Identifier, PkgName } from '../../../../src/dataflow/environments/identifier';
import { CallProp, SemanticCallTag } from '../../../../src/dataflow/environments/built-in-props';

/**
 * `functionInfo` is the one access point for what flowR knows about a function, whichever of its sources knows
 * it. These pin that a built-in, a package function and a name flowR states nothing about all answer here.
 */
describe('FlowrAnalyzer.functionInfo', withTreeSitter(parser => {
	async function analyzerFor(code: string) {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(code);
		await analyzer.dataflow();
		return analyzer;
	}

	test('answers for one of flowRs own built-ins', async() => {
		const analyzer = await analyzerFor('nchar("x")');
		const info = analyzer.functionInfo(Identifier.make('nchar'));
		assert.isDefined(info);
		assert.isTrue(info?.builtIn, 'flowR states it itself');
		assert.isTrue(info?.foldable, 'and the value solver folds it');
		assert.include(info?.parameters ?? [], 'x');
	});

	test('carries what only the built-in states', async() => {
		const analyzer = await analyzerFor('read.csv("x.csv")');
		const info = analyzer.functionInfo(Identifier.make('read.csv'));
		assert.include(info?.tags ?? [], SemanticCallTag.File, 'reading a file is a built-in tag, no signature states it');
	});

	test('answers for a package function from the signature database', async() => {
		const analyzer = await analyzerFor('dplyr::lead(1:3)');
		const name = Identifier.make('lead', 'dplyr');
		const db = analyzer.inspectContext().deps.signatures();
		if(!db.available() || db.functionOf(name) === undefined) {
			return; // no signature database on this machine, so there is nothing to answer with
		}
		const info = analyzer.functionInfo(name);
		assert.isDefined(info);
		assert.strictEqual(info?.package, 'dplyr');
		assert.deepEqual(info?.parameters.slice(0, 2), ['x', 'n']);
		assert.isDefined(info?.entry, 'the database entry comes along, for what only it knows');
	});

	test('joins the two where both know the name', async() => {
		const analyzer = await analyzerFor('stats::filter(1:3, 1)');
		const name = Identifier.make('filter', PkgName.Stats);
		const db = analyzer.inspectContext().deps.signatures();
		if(!db.available() || db.functionOf(name) === undefined) {
			return;
		}
		const info = analyzer.functionInfo(name);
		assert.isTrue(info?.builtIn, 'flowR states it');
		assert.isDefined(info?.entry, 'and the database carries it too');
		assert.isTrue(((info?.props ?? 0) & CallProp.Pure) !== 0, 'what the built-in states about it survives the join');
	});

	test('answers nothing for a name neither source knows', async() => {
		const analyzer = await analyzerFor('1');
		assert.isUndefined(analyzer.functionInfo(Identifier.make('thisIsNotAFunctionFlowrKnows')));
	});

	describe('namespaces', () => {
		test('reads a qualified name out of a string the way R spells it', async() => {
			const analyzer = await analyzerFor('dplyr::lead(1:3)');
			const db = analyzer.inspectContext().deps.signatures();
			if(!db.available() || db.functionOf(Identifier.make('lead', 'dplyr')) === undefined) {
				return;
			}
			const info = analyzer.functionInfo('dplyr::lead');
			assert.strictEqual(info?.package, 'dplyr');
			assert.deepEqual(info?.name, Identifier.make('lead', 'dplyr'));
			assert.deepEqual(analyzer.functionInfo('dplyr:::lead')?.name, Identifier.make('lead', 'dplyr', true), 'the internal access is kept');
		});

		test('keeps the two packages of one name apart', async() => {
			const analyzer = await analyzerFor('stats::filter(1:3, 1)\ndplyr::filter(x, y)');
			const db = analyzer.inspectContext().deps.signatures();
			if(!db.available() || db.functionOf(Identifier.make('filter', 'dplyr')) === undefined) {
				return;
			}
			assert.strictEqual(analyzer.functionInfo('stats::filter')?.parameters[0], 'x');
			assert.strictEqual(analyzer.functionInfo('dplyr::filter')?.parameters[0], '.data');
		});

		test('resolves an unqualified name against what the code attaches', async() => {
			const analyzer = await analyzerFor('library(dplyr)\nfilter(x, y)');
			const db = analyzer.inspectContext().deps.signatures();
			if(!db.available() || db.functionOf(Identifier.make('filter', 'dplyr')) === undefined) {
				return;
			}
			const info = analyzer.functionInfo(Identifier.make('filter'));
			assert.strictEqual(info?.package, 'dplyr', 'an attached package sits above the base ones, as in R');
			assert.strictEqual(analyzer.functionInfo(Identifier.make('nchar'))?.package, PkgName.Base, 'and base still answers for its own');
		});

		test('an entry recording no formals does not hide the ones the built-in states', async() => {
			const analyzer = await analyzerFor('nrow(x)');
			const db = analyzer.inspectContext().deps.signatures();
			const entry = db.functionOf(Identifier.make('nrow', PkgName.Base));
			if(!db.available() || entry === undefined || entry.signature.length > 0) {
				return; // this bundle records the formals itself, so there is nothing to fall back from
			}
			assert.deepEqual(analyzer.functionInfo('base::nrow')?.parameters, ['x']);
		});

		test('settles base R even where the database index does not carry the name', async() => {
			const analyzer = await analyzerFor('sum(1:3)');
			const info = analyzer.functionInfo(Identifier.make('sum'));
			assert.strictEqual(info?.package, PkgName.Base, 'base R is known without the database having to say so');
			assert.deepEqual(info?.name, Identifier.make('sum', PkgName.Base));
			assert.strictEqual(analyzer.functionInfo(Identifier.make('sd'))?.package, 'stats', 'and the other base packages likewise');
		});

		test('does not answer an unqualified name with a package nothing attaches', async() => {
			const analyzer = await analyzerFor('1');
			const db = analyzer.inspectContext().deps.signatures();
			if(!db.available() || db.functionOf(Identifier.make('ggplot', 'ggplot2')) === undefined) {
				return;
			}
			assert.isUndefined(analyzer.functionInfo(Identifier.make('ggplot')), 'no library(ggplot2), so no call here reaches it unqualified');
			assert.isDefined(analyzer.functionInfo('ggplot2::ggplot'), 'naming the package still reaches it');
		});
	});
}));
