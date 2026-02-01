import { type FunctionArgument, type OutgoingEdges, isNamedArgument } from './graph';
import { type GenericDiffConfiguration, type GenericDifferenceInformation, setDifference } from '../../util/diff';
import { jsonReplacer } from '../../util/json';
import { arrayEqual } from '../../util/collections/arrays';
import { VertexType } from './vertex';
import { type DataflowGraphEdge, edgeTypesToNames, splitEdgeTypes } from './edge';
import { type NodeId, recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { IdentifierDefinition, IdentifierReference } from '../environments/identifier';
import { diffEnvironmentInformation, diffIdentifierReferences } from '../environments/diff';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { diffControlDependencies } from '../info';
import { type GraphDiffContext, type NamedGraph, initDiffContext, GraphDifferenceReport } from '../../util/diff-graph';
import type { HookInformation } from '../hooks';

/**
 * Compare two dataflow graphs and return a report on the differences.
 * If you simply want to check whether they equal, use {@link GraphDifferenceReport#isEqual|`<result>.isEqual()`}.
 * @see {@link diffOfControlFlowGraphs} - for control flow graphs
 */
export function diffOfDataflowGraphs(left: NamedGraph, right: NamedGraph, config?: Partial<GenericDiffConfiguration>): GraphDifferenceReport {
	if(left.graph === right.graph) {
		return new GraphDifferenceReport();
	}
	const ctx = initDiffContext(left, right, config);
	diffDataflowGraph(ctx);
	return ctx.report;
}

function diffDataflowGraph(ctx: GraphDiffContext): void {
	diffRootVertices(ctx);
	diffVertices(ctx);
	diffOutgoingEdges(ctx);
}

function diffOutgoingEdges(ctx: GraphDiffContext): void {
	const lEdges = new Map(ctx.left.edges());
	const rEdges = new Map(ctx.right.edges());

	if(lEdges.size < rEdges.size && !ctx.config.leftIsSubgraph || lEdges.size > rEdges.size && !ctx.config.rightIsSubgraph) {
		ctx.report.addComment(`Detected different number of edges! ${ctx.leftname} has ${lEdges.size} (${JSON.stringify(lEdges, jsonReplacer)}). ${ctx.rightname} has ${rEdges.size} ${JSON.stringify(rEdges, jsonReplacer)}`);
	}

	for(const [id, edge] of lEdges) {
		/* This has nothing to do with the subset relation as we verify this in the same graph.
		 * Yet we still do the check as a subgraph may not have to have all source vertices for edges.
		 */
		if(!ctx.left.hasVertex(id)) {
			if(!ctx.config.leftIsSubgraph) {
				ctx.report.addComment(`The source ${id} of edges ${JSON.stringify(edge, jsonReplacer)} is not present in ${ctx.leftname}. This means that the graph contains an edge but not the corresponding vertex.`);
				continue;
			}
		}
		diffEdges(ctx, id, edge, rEdges.get(id));
	}
	// just to make it both ways in case the length differs
	for(const [id, edge] of rEdges) {
		if(!ctx.right.hasVertex(id)) {
			if(!ctx.config.rightIsSubgraph) {
				ctx.report.addComment(`The source ${id} of edges ${JSON.stringify(edge, jsonReplacer)} is not present in ${ctx.rightname}. This means that the graph contains an edge but not the corresponding vertex.`);
				continue;
			}
		}
		if(!ctx.config.leftIsSubgraph && !lEdges.has(id)) {
			diffEdges(ctx, id, undefined, edge);
		}
		/* otherwise, we already cover the edge above */
	}
}

function diffRootVertices(ctx: GraphDiffContext): void {
	setDifference(ctx.left.rootIds(), ctx.right.rootIds(), { ...ctx, position: `${ctx.position}Root vertices differ in graphs. ` });
	setDifference(
		new Set([...ctx.left.unknownSideEffects].map(n => typeof n === 'object' ? n.id : n)),
		new Set([...ctx.right.unknownSideEffects].map(n => typeof n === 'object' ? n.id : n)),
		{ ...ctx, position: `${ctx.position}Unknown side effects differ in graphs. ` });
}

function diffFunctionArgumentsReferences(fn: NodeId, a: IdentifierReference | '<value>', b: IdentifierReference | '<value>', ctx: GenericDifferenceInformation<GraphDifferenceReport>): void {
	if(a === '<value>' || b === '<value>') {
		if(a !== b) {
			ctx.report.addComment(
				`${ctx.position}${ctx.leftname}: ${JSON.stringify(a, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(b, jsonReplacer)}`,
				{ tag: 'vertex', id: fn }
			);
		}
		return;
	}
	diffIdentifierReferences(a, b, ctx);
}

/**
 * Checks whether two function argument lists are equal.
 */
export function equalFunctionArguments(fn: NodeId, a: false | readonly FunctionArgument[], b: false | readonly FunctionArgument[]): boolean {
	const ctx: GenericDifferenceInformation<GraphDifferenceReport> = {
		report:    new GraphDifferenceReport(),
		leftname:  'left',
		rightname: 'right',
		position:  '',
		config:    {}
	};
	diffFunctionArguments(fn, a, b, ctx);
	return ctx.report.isEqual();
}

/**
 * Compares two function argument lists and reports differences.
 */
export function diffFunctionArguments(fn: NodeId, a: false | readonly FunctionArgument[], b: false | readonly FunctionArgument[], ctx: GenericDifferenceInformation<GraphDifferenceReport>): void {
	if(a === false || b === false) {
		if(a !== b) {
			ctx.report.addComment(`${ctx.position}${ctx.leftname}: ${JSON.stringify(a, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(b, jsonReplacer)}`, { tag: 'vertex', id: fn });
		}
		return;
	} else if(a.length !== b.length) {
		ctx.report.addComment(`${ctx.position}Differs in number of arguments. ${ctx.leftname}: ${JSON.stringify(a, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(b, jsonReplacer)}`, { tag: 'vertex', id: fn });
		return;
	}
	for(let i = 0; i < a.length; ++i) {
		const aArg = a[i];
		const bArg = b[i];
		if(aArg === EmptyArgument || bArg === EmptyArgument) {
			if(aArg !== bArg) {
				ctx.report.addComment(`${ctx.position}In argument #${i} (of ${ctx.leftname}, empty) the argument differs: ${JSON.stringify(aArg)} vs ${JSON.stringify(bArg)}.`);
			}
		} else if(isNamedArgument(aArg) && isNamedArgument(bArg)) {
			// must have the same name
			if(aArg.name !== bArg.name) {
				ctx.report.addComment(`${ctx.position }In argument #${i} (of ${ctx.leftname}, named) the name differs: ${aArg.name} vs ${bArg.name}.`);
				continue;
			}
			diffFunctionArgumentsReferences(fn, aArg, bArg, {
				...ctx,
				position: `${ctx.position} In argument #${i} (of ${ctx.leftname}, named). `
			});
		} else {
			if(aArg.name !== bArg.name) {
				ctx.report.addComment(`${ctx.position}In argument #${i} (of ${ctx.leftname}, unnamed) the name differs: ${aArg.name} vs ${bArg.name}.`);
			}
			diffControlDependencies(aArg.cds, bArg.cds, { ...ctx, position: `${ctx.position}In argument #${i} (of ${ctx.leftname}, unnamed) the control dependency differs: ${JSON.stringify(aArg.cds)} vs ${JSON.stringify(bArg.cds)}.` });
		}
	}
}

/**
 * Compares the vertices of two dataflow graphs and reports differences.
 */
export function diffVertices(ctx: GraphDiffContext): void {
	// collect vertices from both sides
	const lVert = ctx.left.vertices(true).map(([id, info]) => ([id, info] as const)).toArray();
	const rVert = ctx.right.vertices(true).map(([id, info]) => ([id, info] as const)).toArray();
	if(lVert.length < rVert.length && !ctx.config.leftIsSubgraph
		|| lVert.length > rVert.length && !ctx.config.rightIsSubgraph
	) {
		ctx.report.addComment(`Detected different number of vertices! ${ctx.leftname} has ${lVert.length}, ${ctx.rightname} has ${rVert.length}`);
	}
	for(const [id, lInfo] of lVert) {
		const rInfoMay = ctx.right.get(id);
		if(rInfoMay === undefined) {
			if(!ctx.config.rightIsSubgraph) {
				ctx.report.addComment(`Vertex ${id} is not present in ${ctx.rightname}`, { tag: 'vertex', id });
			}
			continue;
		}
		const [rInfo] = rInfoMay;
		if(lInfo.tag !== rInfo.tag) {
			ctx.report.addComment(`Vertex ${id} differs in tags. ${ctx.leftname}: ${lInfo.tag} vs. ${ctx.rightname}: ${rInfo.tag}`, { tag: 'vertex', id });
		}

		/* as names are optional, we have to recover the other name if at least one of them is no longer available */
		if(lInfo.name !== undefined || rInfo.name !== undefined) {
			const lname = (lInfo.name as string | undefined) ?? recoverName(id, ctx.left.idMap) ?? '??';
			const rname = (rInfo.name as string | undefined) ?? recoverName(id, ctx.right.idMap) ?? '??';
			if(lname !== rname) {
				ctx.report.addComment(`Vertex ${id} differs in names. ${ctx.leftname}: ${String(lname)} vs ${ctx.rightname}: ${String(rname)}`, {
					tag: 'vertex',
					id
				});
			}
		}
		diffControlDependencies(lInfo.cds, rInfo.cds, { ...ctx, position: `Vertex ${id} differs in cds. ` });
		if(lInfo.origin !== undefined || rInfo.origin !== undefined) {
			// compare arrays
			const equalArrays = lInfo.origin && rInfo.origin && arrayEqual(lInfo.origin as unknown as unknown[], rInfo.origin as unknown as unknown[]);
			if(!equalArrays) {
				ctx.report.addComment(`Vertex ${id} differs in origin. ${ctx.leftname}: ${JSON.stringify(lInfo.origin, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(rInfo.origin, jsonReplacer)}`, { tag: 'vertex', id });
			}
		}

		if(lInfo.link !== undefined || rInfo.link !== undefined) {
			const equal = lInfo.link && rInfo.link && arrayEqual(lInfo.link.origin, rInfo.link.origin);
			if(!equal) {
				ctx.report.addComment(`Vertex ${id} differs in link. ${ctx.leftname}: ${JSON.stringify(lInfo.link, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(rInfo.link, jsonReplacer)}`, { tag: 'vertex', id });
			}
		}

		if(
			(lInfo.environment === undefined && rInfo.environment !== undefined && !ctx.config.leftIsSubgraph)
			|| (lInfo.environment !== undefined && rInfo.environment === undefined && !ctx.config.rightIsSubgraph)
		) {
			/* only diff them if specified at all */
			diffEnvironmentInformation(lInfo.environment, rInfo.environment, {
				...ctx,
				position: `${ctx.position}Vertex ${id} differs in environment. `
			});
		}
		if(lInfo.tag === VertexType.FunctionCall) {
			if(rInfo.tag !== VertexType.FunctionCall) {
				ctx.report.addComment(`Vertex ${id} differs in tags. ${ctx.leftname}: ${lInfo.tag} vs. ${ctx.rightname}: ${rInfo.tag}`);
			} else {
				if(lInfo.onlyBuiltin !== rInfo.onlyBuiltin) {
					ctx.report.addComment(`Vertex ${id} differs in onlyBuiltin. ${ctx.leftname}: ${lInfo.onlyBuiltin} vs ${ctx.rightname}: ${rInfo.onlyBuiltin}`, { tag: 'vertex', id });
				}
				if(
					(lInfo.args.length === 0 && rInfo.args.length !== 0 && !ctx.config.leftIsSubgraph)
					|| (lInfo.args.length !== 0 && rInfo.args.length === 0 && !ctx.config.rightIsSubgraph)
				) {
					diffFunctionArguments(lInfo.id, lInfo.args, rInfo.args, {
						...ctx,
						position: `${ctx.position}Vertex ${id} (function call) differs in arguments. `
					});
				}
			}
		}

		if(lInfo.tag === VertexType.FunctionDefinition) {
			if(rInfo.tag !== VertexType.FunctionDefinition) {
				ctx.report.addComment(`Vertex ${id} differs in tags. ${ctx.leftname}: ${lInfo.tag} vs. ${ctx.rightname}: ${rInfo.tag}`, { tag: 'vertex', id });
			} else {
				if(!arrayEqual(lInfo.exitPoints, rInfo.exitPoints, (a, b) => {
					if(a.type !== b.type || a.nodeId !== b.nodeId) {
						return false;
					}
					diffControlDependencies(a.cds, b.cds, { ...ctx, position: '' });
					return true;
				})) {
					ctx.report.addComment(
						`Vertex ${id} differs in exit points. ${ctx.leftname}: ${JSON.stringify(lInfo.exitPoints, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(rInfo.exitPoints, jsonReplacer)}`,
						{ tag: 'vertex', id }
					);
				}
				if(
					(lInfo.subflow.environment === undefined && rInfo.subflow.environment !== undefined && !ctx.config.leftIsSubgraph)
					|| (lInfo.subflow.environment !== undefined && rInfo.subflow.environment === undefined && !ctx.config.rightIsSubgraph)
				) {
					diffEnvironmentInformation(lInfo.subflow.environment, rInfo.subflow.environment, {
						...ctx,
						position: `${ctx.position}Vertex ${id} (function definition) differs in subflow environments. `
					});
				}
				diffInReadParameters(lInfo.params, rInfo.params, {
					...ctx,
					position: `${ctx.position}Vertex ${id} differs in subflow in-read-parameters. `
				});
				setDifference(lInfo.subflow.graph, rInfo.subflow.graph, {
					...ctx,
					position: `${ctx.position}Vertex ${id} differs in subflow graph. `
				});
				diffReferenceLists(id, lInfo.subflow.in, rInfo.subflow.in, {
					...ctx,
					position: `${ctx.position}Vertex ${id} differs in subflow *in* refs. `
				});
				diffReferenceLists(id, lInfo.subflow.out, rInfo.subflow.out, {
					...ctx,
					position: `${ctx.position}Vertex ${id} differs in subflow *out* refs. `
				});
				diffReferenceLists(id, lInfo.subflow.unknownReferences, rInfo.subflow.unknownReferences, {
					...ctx,
					position: `${ctx.position}Vertex ${id} differs in subflow *unknown* refs. `
				});
				diffHooks(lInfo.subflow.hooks, rInfo.subflow.hooks, ctx, id);
			}
		}
	}
}

function diffInReadParameters(l: Record<NodeId, boolean>, r: Record<NodeId, boolean>, ctx: GraphDiffContext): void {
	const lKeys = new Set(Object.keys(l));
	const rKeys = new Set(Object.keys(r));
	setDifference(lKeys, rKeys, { ...ctx, position: `${ctx.position}In-read-parameters differ in graphs. ` });
	for(const k of lKeys) {
		const lVal = l[k];
		const rVal = r[k];
		if(rVal === undefined) {
			if(!ctx.config.rightIsSubgraph) {
				ctx.report.addComment(`In-read-parameter ${k} is not present in ${ctx.rightname}`, { tag: 'vertex', id: k });
			}
			continue;
		}
		if(lVal !== rVal) {
			ctx.report.addComment(`In-read-parameter ${k} differs. ${ctx.leftname}: ${lVal} vs ${ctx.rightname}: ${rVal}`, { tag: 'vertex', id: k });
		}
	}
	for(const k of rKeys) {
		if(!lKeys.has(k)) {
			if(!ctx.config.leftIsSubgraph) {
				ctx.report.addComment(`In-read-parameter ${k} is not present in ${ctx.leftname}`, { tag: 'vertex', id: k });
			}
		}
	}
}

function diffReferenceLists(fn: NodeId, a: readonly IdentifierReference[] | readonly IdentifierDefinition[] | undefined, b: readonly IdentifierReference[] | readonly IdentifierDefinition[] | undefined, ctx: GenericDifferenceInformation<GraphDifferenceReport>): void {
	// sort by id
	if(a === undefined || b === undefined) {
		if(a !== b) {
			ctx.report.addComment(
				`${ctx.position}${ctx.leftname}: ${JSON.stringify(a, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(b, jsonReplacer)}`,
				{ tag: 'vertex', id: fn }
			);
		}
		return;
	}
	if(a.length !== b.length) {
		ctx.report.addComment(
			`${ctx.position}Differs in number of references.\n   - ${ctx.leftname}: ${JSON.stringify(a, jsonReplacer)} vs\n   - ${ctx.rightname}: ${JSON.stringify(b, jsonReplacer)}`,
			{ tag: 'vertex', id: fn }
		);
		return;
	}
	const aSorted = [...a].sort((x, y) => x.nodeId.toString().localeCompare(y.nodeId.toString()));
	const bSorted = [...b].sort((x, y) => x.nodeId.toString().localeCompare(y.nodeId.toString()));
	for(let i = 0; i < aSorted.length; ++i) {
		diffIdentifierReferences(aSorted[i], bSorted[i], {
			...ctx,
			position: `${ctx.position}In reference #${i} ("${aSorted[i].name ?? '?'}", id: ${aSorted[i].nodeId ?? '?'}) `,
		});
	}
}

function diffHooks(left: HookInformation[], right: HookInformation[], ctx: GraphDiffContext, id: NodeId): void {
	// compare length
	if(left.length !== right.length) {
		ctx.report.addComment(`Differs in number of hooks. ${ctx.leftname}: ${JSON.stringify(left, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(right, jsonReplacer)}`, { tag: 'vertex', id });
		return;
	}
	// compare each hook
	for(let i = 0; i < left.length; ++i) {
		const lHook = left[i];
		const rHook = right[i];
		if(lHook.type !== rHook.type) {
			ctx.report.addComment(`Hook #${i} differs in type. ${ctx.leftname}: ${JSON.stringify(lHook.type)} vs ${ctx.rightname}: ${JSON.stringify(rHook.type)}`, { tag: 'vertex', id });
		}
		if(lHook.id !== rHook.id) {
			ctx.report.addComment(`Hook #${i} differs in id. ${ctx.leftname}: ${lHook.id} vs ${ctx.rightname}: ${rHook.id}`, { tag: 'vertex', id });
		}
		if(lHook.add !== rHook.add) {
			ctx.report.addComment(`Hook #${i} differs in add. ${ctx.leftname}: ${lHook.add} vs ${ctx.rightname}: ${rHook.add}`, { tag: 'vertex', id });
		}
		if(lHook.after !== rHook.after) {
			ctx.report.addComment(`Hook #${i} differs in after. ${ctx.leftname}: ${lHook.after} vs ${ctx.rightname}: ${rHook.after}`, { tag: 'vertex', id });
		}
		diffControlDependencies(lHook.cds, rHook.cds, { ...ctx, position: `Hook #${i} differs in control dependencies. ` });
	}
}

function diffEdge(edge: DataflowGraphEdge, otherEdge: DataflowGraphEdge, ctx: GraphDiffContext, id: NodeId, target: NodeId) {
	const edgeTypes = splitEdgeTypes(edge.types);
	const otherEdgeTypes = splitEdgeTypes(otherEdge.types);
	if((edgeTypes.length < otherEdgeTypes.length && !ctx.config.leftIsSubgraph) || (edgeTypes.length > otherEdgeTypes.length && !ctx.config.rightIsSubgraph)) {
		ctx.report.addComment(
			`Target of ${id}->${target} in ${ctx.leftname} differs in number of edge types: ${JSON.stringify([...edgeTypes])} vs ${JSON.stringify([...otherEdgeTypes])}`,
			{ tag: 'edge', from: id, to: target }
		);
	}
	if(edge.types !== otherEdge.types) {
		ctx.report.addComment(
			`Target of ${id}->${target} in ${ctx.leftname} differs in edge types: ${JSON.stringify([...edgeTypesToNames(edge.types)])} vs ${JSON.stringify([...edgeTypesToNames(otherEdge.types)])}`,
			{ tag: 'edge', from: id, to: target }
		);
	}
}

/**
 * Compares two sets of outgoing edges and reports differences.
 */
export function diffEdges(ctx: GraphDiffContext, id: NodeId, lEdges: OutgoingEdges | undefined, rEdges: OutgoingEdges | undefined): void {
	if(lEdges === undefined || rEdges === undefined) {
		if(
			(lEdges === undefined && !ctx.config.leftIsSubgraph)
			|| (rEdges === undefined && !ctx.config.rightIsSubgraph)
		) {
			ctx.report.addComment(
				`Vertex ${id} has undefined outgoing edges. ${ctx.leftname}: ${JSON.stringify(lEdges, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(rEdges, jsonReplacer)}`,
				{ tag: 'vertex', id }
			);
		}
		return;
	}

	if(
		lEdges.size < rEdges.size && !ctx.config.leftIsSubgraph
		|| lEdges.size > rEdges.size && !ctx.config.rightIsSubgraph
	) {
		ctx.report.addComment(
			`Vertex ${id} differs in number of outgoing edges. ${ctx.leftname}: [${[...lEdges.keys()].join(',')}] vs ${ctx.rightname}: [${[...rEdges.keys()].join(',')}] `,
			{ tag: 'vertex', id }
		);
	}
	// order independent compare
	for(const [target, edge] of lEdges) {
		const otherEdge = rEdges.get(target);
		if(otherEdge === undefined) {
			if(!ctx.config.rightIsSubgraph) {
				ctx.report.addComment(
					`Target of ${id}->${target} in ${ctx.leftname} is not present in ${ctx.rightname}`,
					{ tag: 'edge', from: id, to: target }
				);
			}
			continue;
		}
		diffEdge(edge, otherEdge, ctx, id, target);
	}
}
