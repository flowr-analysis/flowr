import type { DataflowLensQuery, DataflowLensQueryResult } from './dataflow-lens-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { reduceDfg } from '../../../util/simple-df/dfg-view';
import { VertexType } from '../../../dataflow/graph/vertex';
import { escapeRegExp } from '../../../abstract-interpretation/data-frame/arguments';
import { OperatorDatabase } from '../../../r-bridge/lang-4.x/ast/model/operators';

/**
 * The lens hides syntax: every operator R has, the native pipe (which {@link OperatorDatabase} does not list), and the
 * control-flow keywords. None of them names anything, unlike the built-in *functions* (`print`, `ifelse`) it keeps.
 * Anchored and escaped, as most of these are regex syntax themselves and an unanchored alternative would also drop
 * every lexeme merely *containing* one (`if` in `identifier`).
 */
const HiddenLexemes = `^(${
	[...Object.keys(OperatorDatabase), '|>', 'function', 'repeat', 'if', 'next', 'break']
		.map(name => escapeRegExp(name)).join('|')
})$`;

/**
 * Executes the given dataflow lens queries using the provided analyzer.
 */
export async function executeDataflowLensQuery({ analyzer }: BasicQueryData, queries: readonly DataflowLensQuery[]): Promise<DataflowLensQueryResult> {
	if(queries.length !== 1) {
		log.warn('Dataflow query expects only up to one query, but got', queries.length);
	}

	const now = Date.now();
	const simplifiedGraph = reduceDfg((await analyzer.dataflow()).graph, {
		vertices: {
			keepEnv:           false,
			keepCd:            true,
			tags:              [VertexType.Use, VertexType.VariableDefinition, VertexType.FunctionDefinition, VertexType.FunctionCall],
			nameRegex:         HiddenLexemes,
			blacklistWithName: true
		}
	}, analyzer.inspectContext().env.makeCleanEnv());

	const timing = Date.now() - now;
	return {
		'.meta': {
			timing
		},
		simplifiedGraph
	};
}
