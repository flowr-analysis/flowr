import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { unpackNonameArg } from '../argument/unpack-argument';
import { wrapArgumentsUnnamed } from '../argument/make-argument';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { removeRQuotes } from '../../../../../../r-bridge/retriever';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { EdgeType } from '../../../../../graph/edge';
import { Identifier } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { resolveEnvirArg } from './built-in-envir-utils';

/**
 * Processes a built-in 'get' function call.
 *
 * When an `envir` argument is present and resolves to a variable with a tracked environment
 * state (set up by `new.env()` + `assign(..., envir=...)`), the lookup is performed inside
 * that environment so that the correct definition is found and the returned {@link DataflowInformation}
 * contains the right read edges.
 */
export function processGet<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	/* use the custom environment for resolution when envir points to a tracked env */
	const resolution = resolveEnvirArg(args, data);

	/* the first arg must be a string naming the variable to retrieve */
	const firstArg = args.length >= 1 ? args[0] : undefined;
	const retrieve = firstArg !== undefined && firstArg !== EmptyArgument
		? unpackNonameArg(firstArg)
		: undefined;

	if(retrieve === undefined || retrieve.type !== RType.String) {
		dataflowLogger.warn(`symbol access with ${Identifier.toString(name.content)} has not 1 string argument, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const treatTargetAsSymbol: RSymbol<OtherInfo & ParentInformation> = {
		type:     RType.Symbol,
		info:     retrieve.info,
		content:  removeRQuotes(retrieve.lexeme),
		lexeme:   retrieve.lexeme,
		location: retrieve.location
	};

	/* resolve in the custom environment if one was found, else the global one.
	 * Pass remaining original args (e.g. envir=e) so they appear as Use vertices in the graph. */
	const { information, processedArguments } = processKnownFunctionCall({
		name,
		args:   [...wrapArgumentsUnnamed([treatTargetAsSymbol], data.completeAst.idMap), ...args.slice(1)],
		rootId,
		data:   resolution ? resolution.envirData : data,
		origin: BuiltInProcName.Get
	});

	const firstProcessed = processedArguments[0];
	if(firstProcessed) {
		information.graph.addEdge(rootId, firstProcessed.entryPoint, EdgeType.Returns | EdgeType.Reads);
	}

	/* direct Reads edge so the slicer can reach the envir variable without needing a second Argument source */
	if(resolution) {
		information.graph.addEdge(rootId, resolution.envirNodeId, EdgeType.Reads);
	}

	/* restore the caller's (global) environment so we don't leak envState upward */
	return { ...information, environment: data.environment };
}
