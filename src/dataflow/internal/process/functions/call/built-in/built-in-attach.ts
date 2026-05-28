import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { unpackArg } from '../argument/unpack-argument';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { ReferenceType, type InGraphIdentifierDefinition, type NamedInGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { define } from '../../../../../environments/define';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { EdgeType } from '../../../../../graph/edge';
import { resolveSymbolToEnvir } from './built-in-envir-utils';

/**
 * Processes `attach(what, ...)` - when `what` is a variable that holds a tracked
 * {@link InGraphIdentifierDefinition#envState}, all statically-known definitions from
 * that environment are injected into the current scope so that subsequent reads of
 * those names resolve correctly.
 */
export function processAttach<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	const result = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Attach }).information;

	const whatArg = args.length >= 1 ? args[0] : undefined;
	const whatNode = whatArg && whatArg !== EmptyArgument ? unpackArg(whatArg) : undefined;

	if(whatNode?.type !== RType.Symbol) {
		handleUnknownSideEffect(result.graph, result.environment, rootId);
		return result;
	}

	const envirResolution = resolveSymbolToEnvir(whatNode.content, whatNode.info.id, data);
	if(!envirResolution) {
		handleUnknownSideEffect(result.graph, result.environment, rootId);
		return result;
	}

	let newEnvironment = result.environment;
	for(const [varName, varDefs] of envirResolution.envDef.envState.current.memory) {
		for(const varDef of varDefs) {
			const inDef = varDef as InGraphIdentifierDefinition;
			const injected: NamedInGraphIdentifierDefinition = {
				...inDef,
				name: varName,
				type: ReferenceType.Variable,
			};
			newEnvironment = define(injected, false, newEnvironment);
			result.graph.addEdge(inDef.nodeId, rootId, EdgeType.Reads);
		}
	}

	return { ...result, environment: newEnvironment };
}
