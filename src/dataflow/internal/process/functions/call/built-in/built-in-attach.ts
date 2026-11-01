import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { ReferenceType, type InGraphIdentifierDefinition, type NamedInGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { Environment, REnvironment } from '../../../../../environments/environment';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { EdgeType } from '../../../../../graph/edge';
import { resolveSymbolToEnvir } from './built-in-envir-utils';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { type AmbientStateAccess, applyAmbientStateAccess } from './built-in-ambient-state';

/** Processes `attach(what, ...)`, injecting the tracked env's known definitions into a new scope layer below `.GlobalEnv`. */
export function processAttach<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { readonly ambient?: AmbientStateAccess | readonly AmbientStateAccess[] } = {}
): DataflowInformation {
	const result = attachLayer(name, args, rootId, data);
	return config.ambient === undefined ? result : applyAmbientStateAccess(result, args, rootId, data, config.ambient);
}

function attachLayer<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const result = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Attach }).information;

	const whatArg = args.length >= 1 ? args[0] : undefined;
	const whatNode = whatArg && whatArg !== EmptyArgument ? RArgument.valueOf(whatArg) : undefined;

	const envirResolution = RSymbol.is(whatNode) ? resolveSymbolToEnvir(whatNode.content, whatNode.info.id, data) : undefined;
	if(!envirResolution) {
		handleUnknownSideEffect(result.graph, result.environment, rootId);
		return result;
	}

	/* build the attached layer with the env's known bindings */
	const injected: NamedInGraphIdentifierDefinition[] = [];
	for(const [varName, varDefs] of envirResolution.envDef.envState.current.memory) {
		for(const varDef of varDefs) {
			const inDef = varDef as InGraphIdentifierDefinition;
			injected.push({
				...inDef,
				name: varName,
				type: ReferenceType.Variable,
			});
			result.graph.addEdge(inDef.nodeId, rootId, EdgeType.Reads);
		}
	}
	const attachedLayer = new Environment(result.environment.current).defineAll(injected);

	/* R attaches below `.GlobalEnv`, so existing global bindings shadow the attached ones */
	return { ...result, environment: {
		current: REnvironment.attachAt(result.environment.current, attachedLayer, attachedLayer),
		level:   result.environment.level
	} };
}
