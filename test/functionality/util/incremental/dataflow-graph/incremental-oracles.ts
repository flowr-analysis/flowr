import { assert } from 'vitest';
import type { FlowrAnalyzer } from '../../../../../src/project/flowr-analyzer';
import { Dataflow } from '../../../../../src/dataflow/graph/df-helper';
import { diffGraphsToMermaidUrl } from '../../../../../src/util/mermaid/dfg';
import { guard } from '../../../../../src/util/assert';
import { type Query, type SupportedQueryTypes, executeQueries } from '../../../../../src/queries/query';
import { jsonReplacer } from '../../../../../src/util/json';
import type { DataflowInformation } from '../../../../../src/dataflow/info';

/**
 * Compares an incremental analysis against a full one.
 * For example, `:dataflow` compares the dataflow graphs (and what the analysis reads and writes at the top level),
 * while `query:dependencies` compares the results of the dependencies query.
 */
export interface Oracle<T = unknown> {
	readonly name: string;
	run(analyzer: FlowrAnalyzer): Promise<T>;
	/** fails with `context` in the message if the incremental result differs from the full one */
	assertMatches(incremental: T, full: T, context: string): void;
}

function stripMeta(value: unknown): unknown {
	return JSON.parse(JSON.stringify(value, (key, v) => key === '.meta' ? undefined : jsonReplacer(key, v))) as unknown;
}

/** The paths at which the two values differ, to name what differs in a large query result. */
function differingPaths(a: unknown, b: unknown, at = '', out: string[] = []): string[] {
	if(out.length >= 10 || JSON.stringify(a) === JSON.stringify(b)) {
		return out;
	}
	if(typeof a === 'object' && typeof b === 'object' && a !== null && b !== null && !Array.isArray(a) && !Array.isArray(b)) {
		for(const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
			differingPaths((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${at}.${key}`, out);
		}
	} else {
		out.push(`${at}: ${JSON.stringify(a)?.slice(0, 300)} vs. ${JSON.stringify(b)?.slice(0, 300)}`);
	}
	return out;
}

function referencesOf(df: DataflowInformation) {
	const ids = (refs: readonly { nodeId: unknown }[]) => refs.map(r => String(r.nodeId)).sort();
	return { in: ids(df.in), out: ids(df.out), unknown: ids(df.unknownReferences), exit: df.exitPoints.map(e => `${e.type}:${String(e.nodeId)}`).sort() };
}

const dataflowOracle: Oracle<DataflowInformation> = {
	name: ':dataflow',
	run:  analyzer => analyzer.dataflow(),
	assertMatches(actual, expected, context) {
		const report = Dataflow.diffGraphs(
			{ name: 'full', graph: expected.graph },
			{ name: 'incremental', graph: actual.graph }
		);
		if(!report.isEqual()) {
			const diff = diffGraphsToMermaidUrl({ label: 'full', graph: expected.graph }, { label: 'incremental', graph: actual.graph }, '');
			assert.fail(`${context}: dataflow graphs differ:\n${report.comments()?.join('\n')}\ndiff: ${diff}`);
		}
		assert.deepStrictEqual(referencesOf(actual), referencesOf(expected), `${context}: top-level references differ`);
		const keys = (df: DataflowInformation) => [...df.graph.idMap?.keys() ?? []].map(String).sort();
		const [got, want] = [keys(actual), keys(expected)];
		assert.deepStrictEqual(got, want, `${context}: the nodes of the id maps differ, missing ${JSON.stringify(want.filter(k => !got.includes(k)))}, extra ${JSON.stringify(got.filter(k => !want.includes(k)))}`);
		assert.deepStrictEqual(JSON.stringify([...actual.graph.statementOrder ?? []]), JSON.stringify([...expected.graph.statementOrder ?? []]), `${context}: statement orders differ`);
		assert.deepStrictEqual([...actual.graph.ambientAccessIds()].map(String).sort(), [...expected.graph.ambientAccessIds()].map(String).sort(), `${context}: ambient accesses differ`);
		assert.deepStrictEqual([...actual.graph.fileWritesPerCall ?? []].map(String).sort(), [...expected.graph.fileWritesPerCall ?? []].map(String).sort(), `${context}: per-call file writes differ`);
		assert.deepStrictEqual([...actual.graph.unknownSideEffects].map(String).sort(), [...expected.graph.unknownSideEffects].map(String).sort(), `${context}: unknown side effects differ`);
	}
};

const RegisteredOracles: Record<string, Oracle> = {
	dataflow: dataflowOracle
};

/** Resolves `:<name>` to a {@link RegisteredOracles|registered oracle} and `query:<type>` to a comparison of that query's results. */
export function resolveOracle(spec: string): Oracle {
	if(spec.startsWith('query:')) {
		const type = spec.slice('query:'.length) as SupportedQueryTypes;
		return {
			name: spec,
			run:  analyzer => executeQueries({ analyzer }, [{ type } as Query]),
			assertMatches(incremental, full, context) {
				const [got, expected] = [stripMeta(incremental), stripMeta(full)];
				assert.deepEqual(got, expected, `${context}: ${spec} results differ between full and incremental analysis at\n${differingPaths(got, expected).join('\n')}\n`);
			}
		};
	}
	guard(spec.startsWith(':'), `Unknown oracle spec "${spec}" (expected ":<name>" or "query:<type>")`);
	const name = spec.slice(1);
	const oracle = RegisteredOracles[name];
	guard(oracle !== undefined, `Unknown oracle ":${name}", known: ${Object.keys(RegisteredOracles).map(n => `:${n}`).join(', ')}`);
	return oracle;
}
