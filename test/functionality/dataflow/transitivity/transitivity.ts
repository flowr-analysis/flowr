import { assert, test, type TestContext } from 'vitest';
import { label } from '../../_helper/label';
import type { FlowrCapabilityId } from '../../../../src/r-bridge/data/get';
import { printedByProgram, printedByR } from '../../_helper/shell';
import type { KnownParser } from '../../../../src/r-bridge/parser';
import { RNode } from '../../../../src/r-bridge/lang-4.x/ast/model/model';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { Resolve } from '../../../../src/dataflow/environments/resolve-helper';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { EdgeType } from '../../../../src/dataflow/graph/edge';
import { isValue, RValue, type Lift, type Value } from '../../../../src/dataflow/eval/values/r-value';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { uniqueArray } from '../../../../src/util/collections/arrays';
import { SourceRange } from '../../../../src/util/range';
import type { BrandedIdentifier } from '../../../../src/dataflow/environments/identifier';

/**
 * How a case relates to R: `red` names what R does and what flowR does instead when flowR is wrong (the test is
 * expected to fail), `imprecise` names the over-approximation flowR answers with that is still sound.
 */
export interface Verdict {
	readonly red?:       string
	readonly imprecise?: string
}

/** One program with what is asked of it, the last line prints the value to check. */
export interface TransitivityCase extends Verdict {
	readonly name:       string
	readonly code:       string
	/** the criterion to slice for, defaults to the call on the last line */
	readonly criterion?: SlicingCriterion
	/** code the slice must not hold, unless the case is `imprecise` */
	readonly dropped?:   string
	/** further files the program sources, by name */
	readonly files?:     Readonly<Record<string, string>>
	/** whether to analyze with the shipped signature database */
	readonly sigdb?:     boolean
}

let tested: readonly FlowrCapabilityId[] = [];

/**
 * Registers the cases `define` defines as tests of the given capabilities, so the capability catalog lists them.
 * @example
 * ```ts
 * testing(['higher-order-functions'], () => {
 *     resolvesLikeR(parser, 'Reduce folds', 'Reduce(function(a, b) a + b, 1:3)', '1@Reduce');
 * });
 * ```
 */
export function testing(capabilities: readonly FlowrCapabilityId[], define: () => void): void {
	const outer = tested;
	tested = [...outer, ...capabilities];
	try {
		define();
	} finally {
		tested = outer;
	}
}

function caseTest(verdict: Verdict) {
	const run = verdict.red === undefined ? test : test.fails;
	return (name: string, fn: (context: TestContext) => Promise<void>) => run(label(name, tested, ['dataflow']), fn);
}

async function analyzerFor(parser: KnownParser, code: string, files?: Readonly<Record<string, string>>) {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
	if(files) {
		analyzer.addFile(...Object.entries(files).map(([name, content]) => new FlowrInlineTextFile(name, content)));
	}
	analyzer.addRequest(requestFromInput(code));
	return analyzer;
}

function lastCall(code: string): SlicingCriterion {
	const lines = code.split('\n');
	return `${lines.length}@${/^(\w+)\(/.exec(lines[lines.length - 1])?.[1] ?? 'print'}` as SlicingCriterion;
}

/** the slice for the last line, run by R, prints what the whole program prints last */
export function sliceMatchesR(parser: KnownParser, c: TransitivityCase): void {
	caseTest(c)(c.name, async({ skip }) => {
		const disabled = process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
		if(c.sigdb) {
			delete process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
		}
		const slice = await (async() => {
			const analyzer = await analyzerFor(parser, c.code, c.files);
			const sliced = await analyzer.query([{ type: 'static-slice', criteria: [c.criterion ?? lastCall(c.code)] }]);
			return (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
		})().finally(() => {
			if(disabled !== undefined) {
				process.env.FLOWR_DISABLE_DEFAULT_SIGDB = disabled;
			}
		});
		const program = (await printedByProgram(c.code, skip, c.files)).split('\n').at(-1);
		const part = (await printedByR(slice, c.files).catch((e: Error) => `error: ${e.message.trimEnd()}`)).split('\n').at(-1);
		assert.strictEqual(part, program, `the slice:\n${slice}`);
		if(c.dropped !== undefined && c.imprecise === undefined) {
			assert.notInclude(slice, c.dropped, `the slice:\n${slice}`);
		}
	});
}

/** the plain values a resolved value stands for, `?` for any part that is not a known constant */
function plainValues(value: Lift<Value>): string[] {
	if(!isValue(value)) {
		return ['?'];
	}
	switch(value.type) {
		case 'set':
			return isValue(value.elements) ? value.elements.flatMap(plainValues) : ['?'];
		case 'vector':
			return isValue(value.elements) && value.elements.length === 1 ? plainValues(value.elements[0]) : ['?'];
		case 'logical':
			return isValue(value.value) && value.value !== 'maybe' ? [value.value ? 'TRUE' : 'FALSE'] : ['?'];
		case 'null':
			return ['NULL'];
		default: {
			const plain = RValue.numberOf(value) ?? RValue.stringOf(value);
			return plain === undefined ? ['?'] : [String(plain)];
		}
	}
}

/**
 * The value at `criterion` resolves to exactly what the program prints last with `cat`. With `imprecise`, a sound
 * over-approximation (the printed value among others, or unknown) is accepted.
 */
export function resolvesLikeR(parser: KnownParser, name: string, code: string, criterion: SlicingCriterion, verdict: Verdict = {}): void {
	caseTest(verdict)(name, async({ skip }) => {
		const analyzer = await analyzerFor(parser, code);
		const { graph } = await analyzer.dataflow();
		const idMap = (await analyzer.normalize()).idMap;
		const id = SlicingCriterion.parse(criterion, idMap);
		const values = uniqueArray(plainValues(Resolve.toValue(id, { graph, full: true, idMap, resolve: analyzer.flowrConfig.solver.variables, ctx: analyzer.inspectContext() }))).sort();
		const printed = (await printedByProgram(code, skip)).split('\n').at(-1) ?? '';
		if(verdict.imprecise === undefined) {
			assert.deepStrictEqual(values, [printed]);
		} else {
			assert.isTrue(values.includes('?') || values.includes(printed), `${JSON.stringify(values)} misses ${printed}`);
		}
	});
}

/** the call at `criterion` reaches the definitions `reaches`, directly or through the call graph (R checks the program prints `ok`) */
export function callsLikeR(parser: KnownParser, name: string, code: string, criterion: SlicingCriterion, reaches: readonly SlicingCriterion[], verdict: Verdict = {}): void {
	caseTest(verdict)(name, async({ skip }) => {
		const analyzer = await analyzerFor(parser, code);
		const { idMap } = await analyzer.normalize();
		const graph = (await analyzer.dataflow()).graph;
		const call = SlicingCriterion.parse(criterion, idMap);
		const callGraph = await analyzer.callGraph();
		const targets = new Set<NodeId>([...Dataflow.targetsOf(graph, call, EdgeType.Calls), ...Dataflow.callTargetsOf(call, graph)]);
		const todo = [call, ...targets];
		for(let id = todo.pop(); id !== undefined; id = todo.pop()) {
			for(const next of callGraph.edgesFrom(id)?.keys() ?? []) {
				if(!targets.has(next)) {
					targets.add(next);
					todo.push(next);
				}
			}
		}
		assert.strictEqual((await printedByProgram(code, skip)).split('\n').at(-1), 'ok');
		for(const r of reaches) {
			assert.isTrue(targets.has(SlicingCriterion.parse(r, idMap)), `${criterion} should call ${r}, has ${JSON.stringify([...targets])}`);
		}
	});
}

/**
 * the global state `scope` (the top-level expression on that line) writes, transitively, includes `writes`, an imprecise
 * case may answer with any option for a specific one; R checks the program prints `ok`
 */
export function writesLikeR(parser: KnownParser, name: string, code: string, line: number, writes: readonly string[], verdict: Verdict = {}): void {
	caseTest(verdict)(name, async({ skip }) => {
		const analyzer = await analyzerFor(parser, code);
		const info = await analyzer.dataflow();
		const { ast } = await analyzer.normalize();
		const scope = ast.files[0].root.children.filter(c => SourceRange.fromNode(c)?.[0] === line).flatMap(c => [...RNode.collectAllIds(c)]);
		assert.isNotEmpty(scope, `nothing on line ${line}`);
		const access = Dataflow.sideEffects.ambientAccess(info, scope);
		assert.strictEqual((await printedByProgram(code, skip)).split('\n').at(-1), 'ok');
		const written: BrandedIdentifier[] = [...access.writes.keys(), ...access.variables.keys()];
		/* an imprecise case may only know that some option, variable, ... changes (`#option:*`) */
		const missing = writes.filter(w => !written.includes(w) && !(verdict.imprecise !== undefined && written.includes(w.replace(/:.*$/, ':*'))));
		assert.isEmpty(missing, JSON.stringify(written));
	});
}
