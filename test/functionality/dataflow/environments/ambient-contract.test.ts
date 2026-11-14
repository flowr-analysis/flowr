import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { Resolve } from '../../../../src/dataflow/environments/resolve-helper';
import { AmbientContract } from '../../../../src/dataflow/environments/ambient-contract';
import { AmbientVerb, ambientSummaryOf } from '../../../../src/dataflow/environments/ambient-effect';
import { BuiltInIndex } from '../../../../src/dataflow/environments/query-fn-props';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { DfgVertex } from '../../../../src/dataflow/graph/vertex';
import { Ternary } from '../../../../src/util/logic';
import { SourceRange } from '../../../../src/util/range';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe('Ambient contracts of calls', withTreeSitter(ts => {
	/** per definition the call of `fn` in line `line` (`2@map`) may reach, its effects as `happens family access [keys] (open condition) @ deciders` */
	async function contracts(code: string, criterion: string): Promise<Record<string, string[]>> {
		const [line, fn] = criterion.split('@');
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
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
				...effect.when === undefined ? [] : [`(if ${AmbientContract.words(effect.when)})`],
				...effect.unless === undefined ? [] : [`(unless ${AmbientContract.words(effect.unless)})`],
				...decidedBy.length === 0 ? [] : [`@${decidedBy.map(shown).join(',')}`]].join(' ')),
			...c.ruledOut.map(({ effect, decidedBy }) => [`never ${effect.family} ${effect.access}`, ...decidedBy.length === 0 ? [] : [`@${decidedBy.map(shown).join(',')}`]].join(' '))
		]]));
	}
	function check(name: string, code: string, criterion: string, expected: Record<string, string[]>): void {
		test(label(name, [], ['dataflow']), async() => {
			assert.deepStrictEqual(await contracts(code, criterion), expected);
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
	test('a summary states its conditions as data', () => {
		const curve = ambientSummaryOf({ ...BuiltInIndex.default().get('curve') }).flatMap(f => f.accesses);
		assert.deepStrictEqual(curve.filter(a => a.holds !== undefined).map(a => [a.access, a.holds]), [[AmbientVerb.Adds, { when: { flag: 'add' } }], [AmbientVerb.Resets, { unless: { flag: 'add' } }]]);
		assert.isTrue(curve.filter(a => a.holds === undefined).every(a => a.when.length === 0));
	});
	test('narrowing without an analysis takes only what is written', () => {
		const effects = AmbientContract.effectsOf({ ...BuiltInIndex.default().get('curve') });
		assert.deepStrictEqual(AmbientContract.narrow(effects, []).effects.map(e => [e.effect.access, e.happens]), [[AmbientVerb.Resets, Ternary.Always], [AmbientVerb.Reads, Ternary.Always], [AmbientVerb.Reads, Ternary.Always]]);
	});
}));
