import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { ReferenceType, type InGraphIdentifierDefinition, type NamedInGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { DefaultAttachPosition, Environment, REnvironment } from '../../../../../environments/environment';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { EdgeType } from '../../../../../graph/edge';
import { resolveAttachPosition, resolveSymbolToEnvir } from './built-in-envir-utils';
import { AmbientStateAccessType } from './built-in-ambient-state';
import { keysOf } from './built-in-ambient-keys';
import { UnknownKey } from '../../../../../environments/ambient-state-name';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AmbientConfig } from '../../../../../environments/built-in';

/** Processes `attach(what, ...)`, injecting the tracked env's known definitions into a new scope layer below `.GlobalEnv`. */
export function processAttach<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	/* the search path it writes is applied by the registration, see {@link AmbientConfig} */
	_config: AmbientConfig = {}
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

/**
 * Processes `detach(name)` and `unloadNamespace(ns)`: the search path entry named (`package:x`, `"x"`, a position, the
 * topmost one if nothing is given) is removed, uncovering what it masked. The entry is read with the keys of the
 * call's search path {@link AmbientConfig|ambient} write.
 */
export function processDetach<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: AmbientConfig = {}
): DataflowInformation {
	const info = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Detach }).information;
	const keys = [config.ambient ?? []].flat().flatMap(a => a.type === AmbientStateAccessType.SetKeyed ? keysOf(a.keys, args, data) : []);
	const first = RArgument.valueOf(args.find(a => a !== EmptyArgument));
	const positions = first === undefined ? [DefaultAttachPosition]
		: keys.includes(UnknownKey) ? [resolveAttachPosition(first.info.id, data)]
			: keys.map(k => REnvironment.searchPosition(info.environment.current, k));
	/* what a later read no longer finds still depends on the removal, which only an unknown side effect tells it */
	handleUnknownSideEffect(info.graph, info.environment, rootId);
	if(!positions.includes(undefined)) {
		for(const pos of positions) {
			info.environment = { level: info.environment.level, current: REnvironment.detachAt(info.environment.current, pos) };
		}
	}
	return info;
}
