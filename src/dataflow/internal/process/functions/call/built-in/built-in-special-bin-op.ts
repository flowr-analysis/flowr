import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ControlDependency, DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { ControlFlow } from '../../../../control-flow';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { EdgeType } from '../../../../../graph/edge';
import type { ForceArguments } from '../common';
import { Identifier } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';

/**
 * Process a special built-in binary operator, possibly lazily.
 * Only `&&`/`||` short-circuit: their right-hand side gets a control dependency and only the left is read.
 * The vectorized `&`/`|` evaluate both and hence use `lazy: false`.
 * Not related to R's special binary operators like `%in%`.
 */
export function processSpecialBinOp<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { readonly lazy: boolean, readonly evalRhsWhen?: boolean } & ForceArguments
): DataflowInformation {
	if(args.length != 2) {
		dataflowLogger.warn(`Logical bin-op ${Identifier.toString(name.content)} has something else than 2 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs, origin: 'default' }).information;
	}

	/* the very dependency the right-hand side runs under, carried by its vertices and by the branch alike */
	const evalsRhs: ControlDependency = { id: rootId, when: config.evalRhsWhen ?? true };
	const { information, processedArguments } = processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs,
		patchData: (d, i) => {
			if(config.lazy && i === 1) {
				return { ...d, cds: [...d.cds ?? [], evalsRhs] };
			}
			return d;
		},
		customControlFlow: config.lazy,
		origin:            BuiltInProcName.SpecialBinOp
	});

	for(const arg of processedArguments) {
		if(arg) {
			information.graph.addEdge(rootId, arg.entryPoint, EdgeType.Reads);
		}
		if(config.lazy) {
			break;
		}
	}

	const [lhs, rhs] = processedArguments;
	if(config.lazy && lhs !== undefined) {
		const graph = information.graph;
		if(rhs !== undefined) {
			ControlFlow.branchesTo(graph, lhs, ControlFlow.entryOf(rhs), evalsRhs);
			ControlFlow.continuesWith(graph, rhs, rootId);
		}
		ControlFlow.branchesTo(graph, lhs, rootId, { id: rootId, when: !evalsRhs.when });
		return { ...information, cfgEntry: ControlFlow.entryOf(lhs), cfgExit: rootId };
	}

	return information;
}
