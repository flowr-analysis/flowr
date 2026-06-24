import { type DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverName } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../../../../../graph/vertex';
import { dataflowLogger } from '../../../../../logger';
import { Dataflow } from '../../../../../graph/df-helper';
import type { IdentifierReference } from '../../../../../environments/identifier';
import { EdgeType } from '../../../../../graph/edge';
import type { ForceArguments } from '../common';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { FunctionArgument } from '../../../../../graph/graph';

interface QuoteConfig extends ForceArguments {
	quoteArgumentsWithIndex: number
	envArgIndex?:            number
}


/**
 * Process a call to `quote` or similar nse/substitution functions.
 */
export function processQuote<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: QuoteConfig
): DataflowInformation {
	const startEnv = data.environment;
	let lastEnv = startEnv;
	const { information, processedArguments, fnRef } = processKnownFunctionCall({
		name, args, rootId, data, forceArgs: config.forceArgs, origin: BuiltInProcName.Quote,
		patchData(data: DataflowProcessorInformation<OtherInfo & ParentInformation>, index: number): DataflowProcessorInformation<OtherInfo & ParentInformation> {
			if(index === config.quoteArgumentsWithIndex) {
				lastEnv = data.environment;
				return { ...data, environment: data.ctx.env.makeCleanEnv() };
			} else {
				return { ...data, environment: lastEnv };
			}
		}
	});

	let inRefs: IdentifierReference[] = [fnRef];
	let outRefs: IdentifierReference[] = [];
	let unknownRefs: IdentifierReference[] = [];

	for(let i = 0; i < args.length; i++) {
		const processedArg = processedArguments[i];
		if(processedArg && i !== config?.quoteArgumentsWithIndex) {
			inRefs = inRefs.concat(processedArg.in);
			outRefs = outRefs.concat(processedArg.out);
			unknownRefs = unknownRefs.concat(processedArg.unknownReferences);
		} else if(processedArg) {
			information.graph.addEdge(rootId, processedArg.entryPoint, EdgeType.NonStandardEvaluation);
			/* nse actually affects _everything_ within that argument! */
			for(const [vtx] of processedArg.graph.vertices(true)) {
				information.graph.addEdge(rootId, vtx, EdgeType.NonStandardEvaluation);
			}
		}
	}

	if(config?.envArgIndex !== undefined) {
		const envProcessed = processedArguments[config.envArgIndex];
		const exprProcessed = processedArguments[config.quoteArgumentsWithIndex];
		if(envProcessed && exprProcessed) {
			try {
				// traverse the env processed DFG to find list calls (prefix-aware handling)
				Dataflow.visitDfg(envProcessed.graph, envProcessed.entryPoint, (vtx) => {
					if(vtx.tag !== VertexType.FunctionCall) {
						return;
					}
					if(!vtx.origin.includes(BuiltInProcName.List)) {
						return true;
					}

					const useMap = new Map<string, NodeId[]>();
					for(const vType of [VertexType.Use, VertexType.FunctionCall]) {
						for(const [useId] of exprProcessed.graph.verticesOfType(vType)) {
							const rn = recoverName(useId, exprProcessed.graph.idMap);
							if(rn) {
								const arr = useMap.get(rn) ?? [];
								arr.push(useId);
								useMap.set(rn, arr);
							}
						}
					}
					if(useMap.size === 0) {
						return true;
					}

					const listFields = vtx.args.filter(FunctionArgument.isNamed);
					for(const field of listFields) {
						const uses = useMap.get(field.name);
						if(uses) {
							for(const useId of uses) {
								information.graph.addEdge(useId, field.nodeId, EdgeType.Reads);
							}
						}
					}
					return true;
				});
			} catch(e) {
				dataflowLogger.warn('Failed to apply substitute-style env list replacement in quote-like call', { error: e });
			}
		}
	}

	return {
		...information,
		environment:       startEnv,
		in:                inRefs,
		out:               outRefs,
		unknownReferences: unknownRefs
	};
}
