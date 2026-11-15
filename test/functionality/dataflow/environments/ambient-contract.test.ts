import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { Resolve } from '../../../../src/dataflow/environments/resolve-helper';
import { AmbientContract } from '../../../../src/dataflow/environments/ambient-contract';
import { AmbientPart, AmbientVerb, AmbientWording, ambientSummaryOf } from '../../../../src/dataflow/environments/ambient-effect';
import { BuiltInIndex } from '../../../../src/dataflow/environments/query-fn-props';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { DfgVertex } from '../../../../src/dataflow/graph/vertex';
import { Ternary } from '../../../../src/util/logic';
import { SourceRange } from '../../../../src/util/range';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe('Ambient contracts of calls', withTreeSitter(ts => {
	/** per definition the call of `fn` in line `line` (`2@map`) may reach, its effects as `happens family access [keys] (open condition) @ deciders` */
	async function contracts(code: string, criterion: string, files: readonly FlowrInlineTextFile[] = []): Promise<Record<string, string[]>> {
		const [line, fn] = criterion.split('@');
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addFile(...files);
		analyzer.addRequest(requestFromInput(code));
		const info = await Resolve.infoOf(analyzer);
		const idMap = (await analyzer.normalize()).idMap;
		const call = [...info.graph?.vertices(true) ?? []].find(([id, v]) => DfgVertex.isFunctionCall(v) && Identifier.getName(v.name) === fn && SourceRange.getStartLine(idMap.get(id)?.location) === Number(line))?.[0];
		assert.isDefined(call, criterion);
		const shown = (id: NodeId) => {
			const node = idMap.get(id);
			return `${SourceRange.getStartLine(node?.location) ?? '?'}@${node?.lexeme ?? '?'}`;
		};
		return Object.fromEntries(AmbientContract.ofCall(call, info).map(c => [Identifier.toString(c.definition), [
			...c.effects.map(({ happens, effect, keys, decidedBy }) => [happens, effect.family, effect.access,
				...keys === undefined ? [] : [`[${keys.join(', ')}]`],
				...effect.when === undefined ? [] : [`(if ${AmbientWording.condition(effect.when)})`],
				...effect.unless === undefined ? [] : [`(unless ${AmbientWording.condition(effect.unless)})`],
				...decidedBy.length === 0 ? [] : [`@${decidedBy.map(shown).join(',')}`]].join(' ')),
			...c.ruledOut.map(({ effect, decidedBy }) => [`never ${effect.family} ${effect.access}`, ...decidedBy.length === 0 ? [] : [`@${decidedBy.map(shown).join(',')}`]].join(' '))
		]]));
	}
	function check(name: string, code: string, criterion: string, expected: Record<string, string[]>, files: readonly FlowrInlineTextFile[] = []): void {
		test(label(name, [], ['dataflow']), async() => {
			assert.deepStrictEqual(await contracts(code, criterion, files), expected);
		});
	}

	const plot = ['always par reads', 'always palette reads'];
	describe('the arguments decide the conditions', () => {
		check('a flag written out', 'maps::map(add = TRUE)', '1@map', { 'maps::map': ['always plot adds @1@add', ...plot, 'never plot resets @1@add'] });
		check('a flag left out', 'maps::map("world")', '1@map', { 'maps::map': ['always plot resets', ...plot, 'never plot adds'] });
		check('a flag bound to a variable', 'a <- TRUE\nmaps::map(add = a)', '2@map', { 'maps::map': ['always plot adds @2@add', ...plot, 'never plot resets @2@add'] });
		check('a flag of an unknown value', 'maps::map(add = runif(1) > 0.5)', '1@map', { 'maps::map': ['maybe plot adds (if add is TRUE) @1@add', 'maybe plot resets (unless add is TRUE) @1@add', ...plot] });
		check('forwarded arguments may give the flag', 'f <- function(...) maps::map(...)', '1@map', { 'maps::map': ['maybe plot adds (if add is TRUE)', 'maybe plot resets (unless add is TRUE)', ...plot] });
		check('forwarded arguments next to the flag', 'f <- function(...) maps::map(add = TRUE, ...)', '1@map', { 'maps::map': ['always plot adds @1@add', ...plot, 'never plot resets @1@add'] });
		check('forwarded arguments may be none', 'f <- function(...) palette(...)', '1@palette', { 'grDevices::palette': ['always palette reads', 'maybe palette writes (unless it has no arguments) @1@...'] });
	});
	describe('the arguments name the entries', () => {
		check('a quoted package', 'library(dplyr)', '1@library', { 'base::library': ['always search-path writes [dplyr]', 'always lib-paths reads', 'always installed-packages reads [dplyr]'] });
		check('a package named by a variable', 'p <- "tidyr"\nlibrary(p, character.only = TRUE)', '2@library', { 'base::library': ['always search-path writes [tidyr]', 'always lib-paths reads', 'always installed-packages reads [tidyr]'] });
		check('forwarded packages are unknown', 'f <- function(...) pacman::p_load(...)', '1@p_load', { 'pacman::p_load': ['always search-path writes [*]', 'always installed-packages adds [*]', 'always lib-paths reads'] });
	});
	describe('each definition has its own contract', () => {
		check('the maps map draws', 'library(maps)\nmap(add = TRUE)', '2@map', { 'maps::map': ['always plot adds @2@add', ...plot, 'never plot resets @2@add'] });
		check('the purrr map does not', 'purrr::map(1:3, f)', '1@map', {});
	});
	describe('contracts reach across calls of own functions', () => {
		const adds = (at: string) => ['always plot adds @' + at, ...plot, 'never plot resets @' + at];
		const either = ['maybe plot adds (if add is TRUE) @2@add', 'maybe plot resets (unless add is TRUE) @2@add', ...plot];
		check('a call of a function handing on its dots', 'g <- function(...) maps::map(...)\ng(add = TRUE)', '2@g', { 'maps::map': adds('2@add') });
		check('the call handing on the dots, seen from its only call', 'g <- function(...) maps::map(...)\ng(add = TRUE)', '1@map', { 'maps::map': adds('2@add') });
		check('calls that disagree leave it open', 'g <- function(...) maps::map(...)\ng(add = TRUE)\ng()', '1@map', { 'maps::map': either });
		check('a parameter handed on by name', 'g <- function(a) maps::map(add = a)\ng(FALSE)', '2@g', { 'maps::map': ['always plot resets @2@FALSE', ...plot, 'never plot adds @2@FALSE'] });
		check('the default of a parameter', 'g <- function(a = TRUE) maps::map(add = a)\ng()', '2@g', { 'maps::map': adds('1@add') });
		check('a chain of functions handing on the dots', 'g <- function(...) maps::map(...)\nh <- function(...) g(...)\nh(add = TRUE)', '3@h', { 'maps::map': adds('3@add') });
		check('a function run with arguments of its own making stays open', 'g <- function(...) maps::map(...)\nlapply(1, g, add = TRUE)', '1@map', { 'maps::map': ['maybe plot adds (if add is TRUE)', 'maybe plot resets (unless add is TRUE)', ...plot] });
		check('a recursive function stops', 'g <- function(n, ...) if(n > 0) g(n - 1, ...) else maps::map(...)\ng(3, add = TRUE)', '1@map', { 'maps::map': adds('2@add') });
		check('a recursive call adding arguments stays open', 'g <- function(n, ...) if(n > 0) g(n - 1, add = FALSE, ...) else maps::map(...)\ng(3, add = TRUE)', '1@map', { 'maps::map': ['maybe plot adds (if add is TRUE) @1@add,2@add', 'maybe plot resets (unless add is TRUE) @1@add,2@add', ...plot] });
		check('parameters of two functions in one call', 'g <- function(a, ...) h(a, ...)\nh <- function(b, ...) maps::map(add = b, ...)\ng(TRUE)\ng(TRUE, fill = TRUE)', '2@map', { 'maps::map': ['always plot adds @4@TRUE,3@TRUE', ...plot, 'never plot resets @4@TRUE,3@TRUE'] });
		check('a package function may be called from outside', 'g <- function(...) maps::map(...)\ng(add = TRUE)', '1@map', { 'maps::map': ['maybe plot adds (if add is TRUE)', 'maybe plot resets (unless add is TRUE)', ...plot] }, [new FlowrInlineTextFile('NAMESPACE', 'export(g)')]);
		check('a call within a package still narrows its callee', 'g <- function(...) maps::map(...)\ng(add = TRUE)', '2@g', { 'maps::map': adds('2@add') }, [new FlowrInlineTextFile('NAMESPACE', 'export(g)')]);
		check('the entries a parameter names', 'f <- function(p) library(p, character.only = TRUE)\nf("dplyr")', '2@f', { 'base::library': ['always search-path writes [dplyr]', 'always lib-paths reads', 'always installed-packages reads [dplyr]'] });
	});
	describe('a contract states its decisions as data', () => {
		async function contractsOf(code: string, line: number, fn: string) {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(requestFromInput(code));
			const info = await Resolve.infoOf(analyzer);
			const idMap = (await analyzer.normalize()).idMap;
			const call = [...info.graph?.vertices(true) ?? []].find(([id, v]) => DfgVertex.isFunctionCall(v) && Identifier.getName(v.name) === fn && SourceRange.getStartLine(idMap.get(id)?.location) === line)?.[0];
			assert.isDefined(call);
			return { contracts: AmbientContract.ofCall(call, info), idMap };
		}
		test('each condition with whether it holds and the argument deciding it', async() => {
			const { contracts: [map], idMap } = await contractsOf('g <- function(...) maps::map(...)\ng(add = TRUE)', 2, 'g');
			const adds = map.effects.find(e => e.effect.family === AmbientPart.Plot && e.effect.access === AmbientVerb.Adds);
			assert.deepStrictEqual(adds?.decisions.when?.condition, { flag: 'add' });
			assert.strictEqual(adds?.decisions.when?.holds, Ternary.Always);
			assert.deepStrictEqual(adds?.decisions.when?.decidedBy.map(id => NodeId.recoverName(id, idMap)), ['add']);
			assert.strictEqual(map.ruledOut[0].decisions.unless?.holds, Ternary.Always);
			assert.lengthOf(map.through, 1);
			assert.strictEqual(NodeId.recoverName(map.call, idMap), 'maps::map');
		});
		test('the entries with the arguments naming them', async() => {
			const { contracts: [library], idMap } = await contractsOf('f <- function(p) library(p, character.only = TRUE)\nf("dplyr")', 2, 'f');
			const attach = library.effects.find(e => e.keys !== undefined && e.effect.access === AmbientVerb.Writes);
			assert.deepStrictEqual(attach?.keys, ['dplyr']);
			assert.deepStrictEqual(attach?.namedBy?.map(id => SourceRange.getStartLine(idMap.get(id)?.location)), [2]);
		});
	});
	test('a summary states its conditions as data', () => {
		const curve = ambientSummaryOf({ ...BuiltInIndex.default().get('curve') }).flatMap(f => f.accesses);
		assert.deepStrictEqual(curve.filter(a => a.when !== undefined || a.unless !== undefined).map(a => [a.access, a.when, a.unless]), [[AmbientVerb.Adds, { flag: 'add' }, undefined], [AmbientVerb.Resets, undefined, { flag: 'add' }]]);
	});
	test('narrowing without an analysis takes only what is written', () => {
		const effects = AmbientContract.effectsOf({ ...BuiltInIndex.default().get('curve') });
		assert.deepStrictEqual(AmbientContract.narrow(effects, []).effects.map(e => [e.effect.access, e.happens]), [[AmbientVerb.Resets, Ternary.Always], [AmbientVerb.Reads, Ternary.Always], [AmbientVerb.Reads, Ternary.Always]]);
	});
}));
