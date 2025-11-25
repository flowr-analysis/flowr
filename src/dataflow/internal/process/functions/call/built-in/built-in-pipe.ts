import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { guard } from '../../../../../../util/assert';
import { unpackArgument } from '../argument/unpack-argument';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { VertexType } from '../../../../../graph/vertex';
import { EdgeType } from '../../../../../graph/edge';
import { ReferenceType } from '../../../../../environments/identifier';



/**
 *
 */
export function processPipe<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const { information, processedArguments } = processKnownFunctionCall({ name, args, rootId, data, origin: 'builtin:pipe' });
	if(args.length !== 2) {
		dataflowLogger.warn(`Pipe ${name.content} has something else than 2 arguments, skipping`);
		return information;
	}

	const [lhs, rhs] = args.map(e => unpackArgument(e));

	guard(lhs !== undefined && rhs !== undefined, () => `lhs and rhs must be present, but ${JSON.stringify(lhs)} and ${JSON.stringify(rhs)} were found instead.`);

	if(rhs.type !== RType.FunctionCall) {
		dataflowLogger.warn(`Expected rhs of pipe to be a function call, but got ${rhs.type} instead.`);
	} else {
		const functionCallNode = information.graph.getVertex(rhs.info.id, true);
		guard(functionCallNode?.tag === VertexType.FunctionCall, () => `Expected function call node with id ${rhs.info.id} to be a function call node, but got ${functionCallNode?.tag} instead.`);

		// make the lhs an argument node:
		const argId =  lhs.info.id;

		dataflowLogger.trace(`Linking pipe arg ${argId} as first argument of ${rhs.info.id}`);
		functionCallNode.args.unshift({
			name:                undefined,
			nodeId:              argId,
			controlDependencies: data.controlDependencies,
			type:                ReferenceType.Function
		});
		information.graph.addEdge(functionCallNode.id, argId, EdgeType.Argument | EdgeType.Reads);
	}

	const firstArgument = processedArguments[0];

	const uniqueIn = information.in.slice();
	for(const ing of (firstArgument?.in ?? [])) {
		if(!uniqueIn.find(e => e.nodeId === ing.nodeId)) {
			uniqueIn.push(ing);
		}
	}
	const uniqueOut = information.out.slice();
	for(const outg of (firstArgument?.out ?? [])) {
		if(!uniqueOut.find(e => e.nodeId === outg.nodeId)) {
			uniqueOut.push(outg);
		}
	}
	const uniqueUnknownReferences = information.unknownReferences.slice();
	for(const unknown of (firstArgument?.unknownReferences ?? [])) {
		if(!uniqueUnknownReferences.find(e => e.nodeId === unknown.nodeId)) {
			uniqueUnknownReferences.push(unknown);
		}
	}


	return {
		...information,
		in:                uniqueIn,
		out:               uniqueOut,
		unknownReferences: uniqueUnknownReferences,
		entryPoint:        rootId
	};
}
