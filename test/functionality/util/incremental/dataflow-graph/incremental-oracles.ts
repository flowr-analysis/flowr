import { assert } from 'vitest';
import type { FlowrAnalyzer } from '../../../../../src/project/flowr-analyzer';
import { Dataflow } from '../../../../../src/dataflow/graph/df-helper';
import { diffGraphsToMermaidUrl } from '../../../../../src/util/mermaid/dfg';
import { guard } from '../../../../../src/util/assert';
import type { Query, SupportedQueryTypes } from '../../../../../src/queries/query';
import { executeQueries } from '../../../../../src/queries/query';
import { jsonReplacer } from '../../../../../src/util/json';

/**
 * Oracle that can be used to define in what way incremental dataflows should be compared in tests.
 * For example, `:dataflow` will compare an incremental and non-incremental dataflow result based on the dataflow, while `query:dependencies` calls the dependencies' query and compares the results of the (non-)incremental analysis.
 */
export interface Oracle<T = unknown> {
	readonly name: string;
	run(analyzer: FlowrAnalyzer): Promise<T>;
	assertMatches(incremental: T, full: T): void;
}

function stripMeta(value: unknown): unknown {
	return JSON.parse(JSON.stringify(value, (key, v) => key === '.meta' ? undefined : jsonReplacer(key, v)));
}

const dataflowOracle: Oracle<Awaited<ReturnType<FlowrAnalyzer['dataflow']>>> = {
	name: ':dataflow',
	run:  analyzer => analyzer.dataflow(),
	assertMatches(actual, expected) {
		const report = Dataflow.diffGraphs(
			{ name: 'expected', graph: expected.graph },
			{ name: 'actual', graph: actual.graph }
		);
		if(!report.isEqual()) {
			const diff = diffGraphsToMermaidUrl({ label: 'expected', graph: expected.graph }, { label: 'actual', graph: actual.graph }, '');
			assert.fail(`dataflow graphs differ:\n${report.comments()?.join('\n')}\ndiff: ${diff}`);
		}
	}
};

const RegisteredOracles: Record<string, Oracle> = {
	dataflow: dataflowOracle
};

/**
 * Calls the specified oracle.
 * See {@link RegisteredOracles}.
 */
export function resolveOracle(spec: string): Oracle {
	if(spec.startsWith('query:')) {
		const type = spec.slice('query:'.length) as SupportedQueryTypes;
		return {
			name: spec,
			run:  analyzer => executeQueries({ analyzer }, [{ type } as Query] as Query[]),
			assertMatches(incremental, full) {
				assert.deepEqual(stripMeta(incremental), stripMeta(full), `${spec} results differ between full and incremental analysis`);
			}
		};
	}

	guard(spec.startsWith(':'), `Unknown oracle spec "${spec}" (expected ":<name>" or "query:<type>")`);

	const name = spec.slice(1);
	const oracle = RegisteredOracles[name];
	guard(oracle !== undefined, `Unknown oracle ":${name}", known: ${Object.keys(RegisteredOracles).map(n => `:${n}`).join(', ')}`);
	return oracle;
}