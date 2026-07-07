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
import { Environment, REnvironment } from '../../../../../environments/environment';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { EdgeType } from '../../../../../graph/edge';
import { resolveSymbolToEnvir } from './built-in-envir-utils';

/** Processes `attach(what, ...)`, injecting the tracked env's known definitions into a new scope layer below `.GlobalEnv`. */
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

	/* build the attached layer with the env's known bindings */
	let attachedLayer = new Environment(result.environment.current);
	for(const [varName, varDefs] of envirResolution.envDef.envState.current.memory) {
		for(const varDef of varDefs) {
			const inDef = varDef as InGraphIdentifierDefinition;
			const injected: NamedInGraphIdentifierDefinition = {
				...inDef,
				name: varName,
				type: ReferenceType.Variable,
			};
			attachedLayer = attachedLayer.define(injected);
			result.graph.addEdge(inDef.nodeId, rootId, EdgeType.Reads);
		}
	}

	/* R attaches below `.GlobalEnv`, so existing global bindings shadow the attached ones */
	return { ...result, environment: {
		current: REnvironment.attachBelowGlobal(result.environment.current, attachedLayer, attachedLayer),
		level:   result.environment.level
	} };
}
