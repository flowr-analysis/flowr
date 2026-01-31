import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltInProcName } from '../../../../../environments/built-in';
import { log } from '../../../../../../util/log';
import { EdgeType } from '../../../../../graph/edge';
import { isFunctionCallVertex } from '../../../../../graph/vertex';
import { UnnamedFunctionCallPrefix } from '../unnamed-call-handling';
import type { REnvironmentInformation } from '../../../../../environments/environment';


/**
 * Processes a built-in 'Recall' function call, linking
 * the recall to the enveloping function closure.
 */
export function processRecall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	const { information } = processKnownFunctionCall({
		name,
		args,
		rootId,
		data,
		origin: BuiltInProcName.Recall
	});

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
			(r as { name: string }).name = UnnamedFunctionCallPrefix + rootId + '-' + r.name;
			(r as { environment: REnvironmentInformation }).environment = information.environment;
		}
	} else {
		log.warn('No enclosing function closure found for recall at node', rootId);
	}

	return information;
}
