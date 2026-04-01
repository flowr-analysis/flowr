import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { pMatch, linkArgumentsOnCall } from '../../../../linker';
import { convertFnArguments } from '../common';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { EdgeType } from '../../../../../graph/edge';
import { unpackNonameArg } from '../argument/unpack-argument';
import { dataflowLogger } from '../../../../../logger';
import { FunctionArgument } from '../../../../../graph/graph';

interface BuiltInPurrFormulaConfiguration {
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

/**
 * Support for R's purr formula: `map(df, ~ .x + 1)`.
 */
export function processPurrFormula<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: BuiltInPurrFormulaConfiguration
): DataflowInformation {
	const { information, callArgs } = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Pipe });

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

	let argToParamMap: Map<NodeId, NodeId> | undefined = new Map<NodeId, NodeId>();
	if(formulaNode.type === RType.FunctionDefinition) {
		const fdef = formulaNode as RFunctionDefinition<ParentInformation & OtherInfo>;
		information.graph.addEdge(rootId, fdef.info.id, EdgeType.Calls);
		const filteredCallArgs: FunctionArgument[] = [];
		for(const arg of callArgs) {
			const aid = FunctionArgument.getId(arg);
			if(aid === formulaArgId || aid === formulaNode.info.id || config.ignore?.includes(FunctionArgument.getName(arg) ?? '')) {
				continue;
			}
			filteredCallArgs.push(arg);
		}
		try {
			argToParamMap = linkArgumentsOnCall(filteredCallArgs, fdef.parameters, information.graph);
		} catch(e){
			dataflowLogger.warn('Failed to link arguments to parameters for purr formula, some bindings may be missing', { error: e });
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
