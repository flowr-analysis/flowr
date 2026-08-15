import { FunctionArgument, type OutgoingEdges, UnknownSideEffect } from './graph';
import { type GenericDifferenceInformation, setDifference } from '../../util/diff';
import { jsonReplacer } from '../../util/json';
import { arrayEqual } from '../../util/collections/arrays';
import { DfEdge } from './edge';
import { type NodeId, recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { IdentifierDefinition, IdentifierReference } from '../environments/identifier';
import { Identifier } from '../environments/identifier';
import { diffEnvironmentInformation, diffIdentifierReferences } from '../environments/diff';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { diffControlDependencies } from '../info';
import type { GraphDifferenceReport, GraphDiffContext } from '../../util/diff-graph';
import { GraphDiff } from '../../util/diff-graph';
import type { HookInformation } from '../hooks';
import { FunctionDefinitionVertex, FunctionCallVertex } from './vertex';


/**
 * This is the underlying function to calculate the difference based on a given context.
 * Use {@link Dataflow.diff} to calculate the diff of two graphs.
 */
export function diffDataflowGraph(ctx: GraphDiffContext): void {
	diffRootVertices(ctx);
	diffVertices(ctx);
	GraphDiff.outgoingEdges(ctx, diffEdges);
}

function diffRootVertices(ctx: GraphDiffContext): void {
	setDifference(ctx.left.rootIds(), ctx.right.rootIds(), { ...ctx, position: `${ctx.position}Root vertices differ in graphs. ` });
	setDifference(
		new Set(ctx.left.unknownSideEffects.values().map(UnknownSideEffect.id)),
		new Set(ctx.right.unknownSideEffects.values().map(UnknownSideEffect.id)),
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
		} else if(FunctionArgument.isNamed(aArg) && FunctionArgument.isNamed(bArg)) {
			// must have the same name
			if(aArg.name !== bArg.name) {
				ctx.report.addComment(`${ctx.position}In argument #${i} (of ${ctx.leftname}, named) the name differs: ${aArg.name} vs ${bArg.name}.`);
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
	const lVert = ctx.left.vertices(true).toArray();
	const rVert = ctx.right.vertices(true).toArray();
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
		if(FunctionCallVertex.is(lInfo)) {
			if(!FunctionCallVertex.is(rInfo)) {
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

		if(FunctionDefinitionVertex.is(lInfo)) {
			if(!FunctionDefinitionVertex.is(rInfo)) {
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
				setDifference(new Set(rInfo.mode ?? []), new Set(lInfo.mode ?? []), {
					...ctx,
					position: `${ctx.position}Vertex ${id} differs in function definition mode. `
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
		const inam = aSorted[i].name;
		diffIdentifierReferences(aSorted[i], bSorted[i], {
			...ctx,
			position: `${ctx.position}In reference #${i} ("${inam ? Identifier.toString(inam) : '?'}", id: ${aSorted[i].nodeId ?? '?'}) `,
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

function diffEdge(edge: DfEdge, otherEdge: DfEdge, ctx: GraphDiffContext, id: NodeId, target: NodeId) {
	const edgeTypes = DfEdge.splitTypes(edge);
	const otherEdgeTypes = DfEdge.splitTypes(otherEdge);
	if((edgeTypes.length < otherEdgeTypes.length && !ctx.config.leftIsSubgraph) || (edgeTypes.length > otherEdgeTypes.length && !ctx.config.rightIsSubgraph)) {
		ctx.report.addComment(
			`Target of ${id}->${target} in ${ctx.leftname} differs in number of edge types: ${JSON.stringify([...edgeTypes])} vs ${JSON.stringify([...otherEdgeTypes])}`,
			{ tag: 'edge', from: id, to: target }
		);
	}
	if(!DfEdge.isOnlyType(edge, otherEdge.types)) {
		ctx.report.addComment(
			`Target of ${id}->${target} in ${ctx.leftname} differs in edge types: ${JSON.stringify([...DfEdge.typesToNames(edge)])} vs ${JSON.stringify([...DfEdge.typesToNames(otherEdge)])}`,
			{ tag: 'edge', from: id, to: target }
		);
	}
}

/**
 * Compares two sets of outgoing edges and reports differences.
 */
export function diffEdges(ctx: GraphDiffContext, id: NodeId, lEdges: OutgoingEdges | undefined, rEdges: OutgoingEdges | undefined): void {
	GraphDiff.edges(ctx, id, lEdges, rEdges, diffEdge);
}
