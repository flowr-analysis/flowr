import type { InspectFnPropsQuery, InspectFnPropsQueryResult } from './inspect-fn-props-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { FunctionArgumentRoles } from '../../../dataflow/fn/argument-roles';
import { ArgProps, CallProps } from '../../../dataflow/environments/built-in-props';
import { FunctionProps } from '../../../dataflow/fn/function-props';
import { QueryFunctionFilter } from '../../query-function-filter';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

/** every bit, for a query naming no properties to keep */
const AllProps = ~0;

/** The formals a query asks about, dropping the ones it does not name and the bits it does not want. */
function keepRoles(all: Record<NodeId, FunctionArgumentRoles>, graph: DataflowGraph, formals: ReadonlySet<string> | undefined, mask: ArgProps): Record<NodeId, FunctionArgumentRoles> {
	if(formals === undefined && mask === AllProps) {
		return all;
	}
	const kept: Record<NodeId, FunctionArgumentRoles> = {};
	for(const [id, roles] of Object.entries(all)) {
		const some: FunctionArgumentRoles = {};
		for(const [formal, props] of Object.entries(roles)) {
			const named = graph.idMap?.get(NodeId.normalize(formal))?.lexeme;
			if((formals === undefined || (named !== undefined && formals.has(named))) && (props & mask) !== 0) {
				some[formal] = props & mask;
			}
		}
		if(Object.keys(some).length > 0) {
			kept[id] = some;
		}
	}
	return kept;
}

/** The function properties a query asks about, dropping the bits it does not want. */
function keepProps(all: Record<NodeId, CallProps>, mask: CallProps): Record<NodeId, CallProps> {
	if(mask === AllProps) {
		return all;
	}
	return Object.fromEntries(Object.entries(all).map(([id, props]) => [id, props & mask]).filter(([, props]) => props !== 0)) as Record<NodeId, CallProps>;
}

/** Execute function-property inspection queries on the given analyzer. */
export async function executeFnPropsQuery({ analyzer }: BasicQueryData, queries: readonly InspectFnPropsQuery[]): Promise<InspectFnPropsQueryResult> {
	const start = Date.now();
	const filterFor = await QueryFunctionFilter.criteria(queries, analyzer);
	const [{ only, formals, props, maxDepth } = {} as InspectFnPropsQuery] = queries;

	const ctx = analyzer.inspectContext();
	const graph = (await analyzer.dataflow()).graph;
	const inferred = FunctionProps.of(QueryFunctionFilter.definitions(graph, filterFor), graph, { ctx, maxDepth, only });

	return {
		'.meta': {
			timing: Date.now() - start
		},
		roles: keepRoles(inferred.roles, graph, formals && new Set(formals), props ? ArgProps.mask(props) : AllProps),
		props: keepProps(inferred.props, props ? CallProps.mask(props) : AllProps)
	};
}
