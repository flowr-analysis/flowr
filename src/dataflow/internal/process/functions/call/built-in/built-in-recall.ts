import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { RNumber } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { log } from '../../../../../../util/log';
import { EdgeType } from '../../../../../graph/edge';
import { isFunctionCallVertex } from '../../../../../graph/vertex';
import { UnnamedFunctionCallPrefix } from '../unnamed-call-handling';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { Identifier } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';

interface RecallConfig {
	/** whether to not handle as a recall function but rather as an unknown side effect if the argument is non-constant non-zero */
	unknownOnNonZeroArg?: boolean;
}

/**
 * Processes a built-in 'Recall' function call, linking
 * the recall to the enveloping function closure.
 */
export function processRecall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: RecallConfig,
): DataflowInformation {
	const { information } = processKnownFunctionCall({
		name,
		args,
		rootId,
		data,
		origin: BuiltInProcName.Recall
	});

	// If requested, treat Recall as an unknown side effect when a single argument is provided and it is not the numeric literal 0.
	if(config?.unknownOnNonZeroArg) {
		if(args.length === 1 && args[0] !== EmptyArgument && args[0].value) {
			const v = args[0].value;
			// only allow the normal recall handling if the single arg is the literal 0
			if(!(v.type === RType.Number && (v as RNumber).content.num === 0)) {
				handleUnknownSideEffect(information.graph, information.environment, rootId);
				return information;
			}
		}
	}



	let cur = data.environment.current;
	let closure: NodeId | undefined;
	while(cur) {
		if(cur.closure) {
			closure = cur.closure;
			break;
		}
		cur = cur.parent;
	}

	if(closure) {
		information.graph.addEdge(rootId, closure, EdgeType.Calls);
		// also kill the name of the recall function
		const r = information.graph.getVertex(rootId);
		if(isFunctionCallVertex(r)){
			(r as { name: string }).name = UnnamedFunctionCallPrefix + rootId + '-' + Identifier.toString(r.name);
			(r as { environment: REnvironmentInformation }).environment = information.environment;
		}
	} else {
		log.warn('No enclosing function closure found for recall at node', rootId);
	}

	return information;
}
