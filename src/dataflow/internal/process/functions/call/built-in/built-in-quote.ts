import { type DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { IdentifierReference } from '../../../../../environments/identifier';
import { EdgeType } from '../../../../../graph/edge';
import type { ForceArguments } from '../common';
import { BuiltInProcName } from '../../../../../environments/built-in';


/**
 * Process a call to `quote` or similar nse/substitution functions.
 */
export function processQuote<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { quoteArgumentsWithIndex?: number } & ForceArguments
): DataflowInformation {
	const startEnv = data.environment;
	const { information, processedArguments, fnRef } = processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs, origin: BuiltInProcName.Quote });

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
			for(const [vtx,] of processedArg.graph.vertices(true)) {
				information.graph.addEdge(rootId, vtx, EdgeType.NonStandardEvaluation);
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
