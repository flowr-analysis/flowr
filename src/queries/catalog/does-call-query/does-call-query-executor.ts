import type { CallsConstraint, DoesCallQuery, DoesCallQueryResult, FindAllCallsResult } from './does-call-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { log } from '../../../util/log';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { CallGraph } from '../../../dataflow/graph/call-graph';
import type { DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { tryResolveSliceCriterionToId } from '../../../slicing/criterion/parse';
import { dropBuiltInPrefix, isBuiltIn } from '../../../dataflow/environments/built-in';
import { Identifier } from '../../../dataflow/environments/identifier';

/**
 * Execute does call queries on the given analyzer.
 */
export async function executeDoesCallQuery({ analyzer }: BasicQueryData, queries: readonly DoesCallQuery[]): Promise<DoesCallQueryResult> {
	const start = Date.now();
	const cg = await analyzer.callGraph();
	const idMap = (await analyzer.normalize()).idMap;
	const results: Record<string, FindAllCallsResult | false> = {};
	for(const query of queries) {
		const id = query.queryId ?? JSON.stringify(query);
		if(id in results) {
			log.warn(`Duplicate query id '${id}' in does-call queries, SKIP.`);
			continue;
		}
		const nodeId = tryResolveSliceCriterionToId(query.call, idMap);
		if(!nodeId) {
			results[id] = false;
			continue;
		}
		const c = makeCallMatcher(query.calls);
		results[id] = findCallersMatchingConstraints(cg, nodeId, c);
	}
	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}

type CheckCallMatch = (vtx: { id: NodeId, name?: Identifier }, cg: CallGraph) => boolean;

function makeCallMatcher(constraint: CallsConstraint): CheckCallMatch {
	switch(constraint.type) {
		case 'calls-id':
			return (vtx) => vtx.id === constraint.id;
		case 'name':
			if(constraint.nameExact) {
				return (vtx) => vtx.name === constraint.name;
			} else {
				const regex = new RegExp(constraint.name);
				return (vtx) => 'name' in vtx && vtx.name ? regex.test(Identifier.getName(vtx.name)) : false;
			}
		case 'and': {
			let matchersAndRemain = constraint.calls.map(makeCallMatcher);
			return (vtx, cg) => {
				const matchersToRemove: CheckCallMatch[] = [];
				for(const matcher of matchersAndRemain) {
					if(matcher(vtx, cg)) {
						matchersToRemove.push(matcher);
					}
				}
				matchersAndRemain = matchersAndRemain.filter(m => !matchersToRemove.includes(m));
				return matchersAndRemain.length === 0;
			};
		}
		case 'or': {
			const matchersOr = constraint.calls.map(makeCallMatcher);
			return (vtx, cg) => matchersOr.some(m => m(vtx, cg));
		}
		default: {
			throw new Error(`Unhandled constraint type ${JSON.stringify(constraint)}`);
		}
	}
}

function findCallersMatchingConstraints(cg: CallGraph, start: NodeId, constraints: CheckCallMatch): FindAllCallsResult | false {
	const visited = new Set<NodeId>();
	const toVisit: NodeId[] = [start];
	while(toVisit.length > 0) {
		const cur = toVisit.pop() as NodeId;
		if(visited.has(cur)) {
			continue;
		}
		visited.add(cur);
		if(isBuiltIn(cur)) {
			const name = dropBuiltInPrefix(cur);
			if(constraints({ id: cur, name } as Required<DataflowGraphVertexFunctionCall>, cg)) {
				return { call: start };
			}
			continue;
		}

		const vtx = cg.getVertex(cur);
		if(!vtx) {
			continue;
		}
		// check if matches
		if(constraints(vtx, cg)) {
			return { call: start };
		}
		for(const out of cg.outgoingEdges(cur) ?? []) {
			toVisit.push(out[0]);
		}
	}
	return false;
}
