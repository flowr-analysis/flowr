import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { getAllFunctionCallTargets, linkArgumentsOnCall, pMatch } from '../../../../linker';
import { Dataflow } from '../../../../../graph/df-helper';
import { VertexType } from '../../../../../graph/vertex';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import type { Identifier, InGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { ReferenceType } from '../../../../../environments/identifier';
import { convertFnArguments } from '../common';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { EdgeType } from '../../../../../graph/edge';
import { unpackNonameArg } from '../argument/unpack-argument';
import { dataflowLogger } from '../../../../../logger';
import type { DataflowGraph } from '../../../../../graph/graph';
import { FunctionArgument } from '../../../../../graph/graph';

interface BuiltInPurrrFormulaConfiguration {
	/**
	 * Maps the created variable/variable to bind in the formula, to the argument that produces it.
	 * For example:
	 * ```ts
	 * {
	 *      '.x': { index: 0, name: '.x' },
	 *      '.y': { index: 1, name: '.y' }
	 * }
	 * ```
	 */
	args:       Record<string, { index: number, name: string }>,
	/**
	 * This represents the special argument that represents the formula.
	 * We map all additional arguments that are not in `ignore` to this list.
	 */
	'.f':       { index: number; name: string };
	/** arguments to additionally ignore when mapping the formulae */
	ignore?:    string[];
	/**
	 * if given, this is a name that indexes into the 'args' map and indicates whatever this function is to return
	 */
	returnArg?: string;
}

function linkOnSymbol<OtherInfo>(rootId: NodeId, filteredArgs: readonly FunctionArgument[], node: RSymbol<OtherInfo & ParentInformation>, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>) {
	// If the formula is a symbol naming a function, try to resolve it in the call environment.
	try {
		const defs = resolveByName(node.content as unknown as Identifier, data.environment, ReferenceType.Function) ?? [];
		graph.addEdge(rootId, node.info.id, EdgeType.Calls);
		for(const def of defs) {
			// Mark the call as calling this target
			graph.addEdge(rootId, def.nodeId, EdgeType.Calls);

			// If the target directly maps to a function definition AST, try to link arguments to parameters
			let linked = data.completeAst.idMap.get(def.nodeId) as RFunctionDefinition<ParentInformation> | undefined;
			if(linked?.type !== RType.FunctionDefinition) {
				for(const vid of (def as InGraphIdentifierDefinition).value as NodeId[]) {
					const candidate = data.completeAst.idMap.get(vid) as RFunctionDefinition<ParentInformation> | undefined;
					if(candidate && candidate.type === RType.FunctionDefinition) {
						linked = candidate;
						// also mark that we call the resolved function-definition node
						graph.addEdge(rootId, vid, EdgeType.Calls);
						break;
					}
				}
			}
			// we may find a candidate in the first check
			if(linked?.type === RType.FunctionDefinition) {
				try {
					return linkArgumentsOnCall(filteredArgs, linked.parameters, graph);
				} catch(e) {
					dataflowLogger.warn('Failed to link arguments to parameters for purr formula (symbol target), some bindings may be missing', { error: e });
				}
			}
		}
	} catch(e) {
		dataflowLogger.warn('Failed to resolve symbol for purrr formula .f', { error: e });
	}
}

/**
 * Support for R's purr formula: `map(df, ~ .x + 1)`.
 */
export function processPurrrFormula<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: BuiltInPurrrFormulaConfiguration
): DataflowInformation {
	const { information, callArgs } = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.PurrrFormula });

	const params: Record<string, string> = {};
	for(const key of Object.keys(config.args)) {
		params[config.args[key].name] = config.args[key].name;
	}
	// formula parameter
	params[config['.f'].name] = config['.f'].name;
	params['...'] = '...';

	const argMaps = pMatch(convertFnArguments(args), params);

	const formulaArgId = argMaps.get(config['.f'].name)?.[0];
	if(!formulaArgId) {
		// nothing to do if we couldn't find the formula argument
		return information;
	}
	const formulaArg = RArgument.getWithId(args, formulaArgId);
	const formulaNode = formulaArg ? unpackNonameArg(formulaArg) : undefined;
	if(!formulaNode) {
		return information;
	}

	let argToParamMap: Map<NodeId, NodeId> = new Map<NodeId, NodeId>();
	// Prepare the list of call arguments to consider for linking (exclude the formula argument and ignored args)
	const filteredCallArgs: FunctionArgument[] = [];
	for(const arg of callArgs) {
		const aid = FunctionArgument.getId(arg);
		if(aid === formulaArgId || aid === formulaNode.info.id || config.ignore?.includes(FunctionArgument.getName(arg) ?? '')) {
			continue;
		}
		filteredCallArgs.push(arg);
	}

	if(formulaNode.type === RType.FunctionDefinition) {
		const fdef = formulaNode as RFunctionDefinition<ParentInformation & OtherInfo>;
		information.graph.addEdge(rootId, fdef.info.id, EdgeType.Calls);
		try {
			argToParamMap = linkArgumentsOnCall(filteredCallArgs, fdef.parameters, information.graph);
		} catch(e){
			dataflowLogger.warn('Failed to link arguments to parameters for purr formula, some bindings may be missing', { error: e });
		}
	} else if(formulaNode.type === RType.Symbol) {
		linkOnSymbol(rootId, filteredCallArgs, formulaNode, information.graph, data);
	} else {
		try {
			Dataflow.visitDfg(information.graph, formulaNode.info.id, (vtx) => {
				if(vtx.tag === VertexType.FunctionCall) {
					information.graph.addEdge(rootId, vtx.id, EdgeType.Calls);

					const targets = getAllFunctionCallTargets(vtx.id, information.graph, vtx.environment);
					for(const t of targets) {
						information.graph.addEdge(rootId, t, EdgeType.Calls);
						const linked = data.completeAst.idMap.get(t) as RFunctionDefinition<ParentInformation> | undefined;
						if(linked && linked.type === RType.FunctionDefinition) {
							try {
								const map = linkArgumentsOnCall(filteredCallArgs, linked.parameters, information.graph);
								for(const [argId, paramId] of map.entries()) {
									if(!argToParamMap.has(argId)) {
										argToParamMap.set(argId, paramId);
									}
								}
							} catch(e) {
								dataflowLogger.warn('Failed to link arguments to parameters for purrr formula (list target)', { error: e });
							}
						}
					}
					return !vtx.origin.includes(BuiltInProcName.List);
				} else if(vtx.tag === VertexType.Use) {
					const node = data.completeAst.idMap.get(vtx.id);
					if(node?.type === RType.Symbol) {
						linkOnSymbol(rootId, filteredCallArgs, node, information.graph, data);
					}
				}
				return false;
			});
		} catch(e) {
			dataflowLogger.warn('Failed to traverse sub-dfg for purrr formula .f', { error: e });
		}
	}

	const ignore = new Set(config.ignore ?? []);
	RNode.visitAst<ParentInformation & OtherInfo>(formulaNode, (node) => {
		if(node.type === RType.Symbol) {
			const sym = node as RSymbol<ParentInformation & OtherInfo>;
			const name = sym.content as unknown as string;
			if(ignore.has(name)) {
				return false;
			}
			const mappingKey = config.args[name]?.name;
			if(mappingKey) {
				const pid = (argMaps.get(mappingKey) ?? [])[0];
				if(!pid) {
					return false;
				}
				const arg = RArgument.getWithId(args, pid);
				const producedNode = arg ? unpackNonameArg(arg) : undefined;
				if(!producedNode) {
					return false;
				}
				// If this argument was linked to a parameter on the call, skip adding edge
				const resultId = producedNode.info.id;
				if(!argToParamMap.has(resultId)) {
					information.graph.addEdge(node.info.id, resultId, EdgeType.Reads);
				}
			}
		}
		return false;
	});


	if(config.returnArg) {
		const returnArgId = argMaps.get(config.returnArg)?.[0];
		if(returnArgId) {
			const returnArg = RArgument.getWithId(args, returnArgId);
			const producedNode = returnArg ? unpackNonameArg(returnArg) : undefined;
			if(producedNode) {
				information.graph.addEdge(rootId, producedNode.info.id, EdgeType.Returns);
			}
		}
	}

	return information;
}
