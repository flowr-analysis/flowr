import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation, RNodeWithParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Resolve } from '../../../../../environments/resolve-helper';
import { datasetShape } from '../../../../../../util/r-datasets';
import { type BrandedIdentifier, Identifier, ReferenceType, type InGraphIdentifierDefinition, type NamedInGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { DefaultAttachPosition, Environment, EnvType, REnvironment } from '../../../../../environments/environment';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { EdgeType } from '../../../../../graph/edge';
import { resolveAttachPosition, resolveSymbolToEnvir } from './built-in-envir-utils';
import { bindsUnknownNames } from './built-in-expression-list';
import { Ambient } from '../../../../../environments/ambient-effect';
import { keysOf } from './built-in-ambient-keys';
import { UnknownKey } from '../../../../../environments/ambient-state-name';
import { EmptyArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { BuiltInFnInfo } from '../../../../../environments/built-in-props';

const AttachableLiterals: ReadonlySet<BrandedIdentifier> = new Set(['list', 'data.frame']);

/** Processes `attach(what, ...)`, injecting the tracked env's known definitions into a new scope layer below `.GlobalEnv`. */
export function processAttach<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	/* the search path it writes is applied by the registration, see {@link BuiltInFnInfo} */
	_config: BuiltInFnInfo = {}
): DataflowInformation {
	const result = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Attach }).information;

	const whatArg = args.length >= 1 ? args[0] : undefined;
	const whatNode = whatArg && whatArg !== EmptyArgument ? RArgument.valueOf(whatArg) : undefined;

	const envirResolution = RSymbol.is(whatNode) ? resolveSymbolToEnvir(whatNode.content, whatNode.info.id, data) : undefined;
	/* a list written out names its bindings, `attach(list(a = 1))` binds `a` to `1` */
	const listed = envirResolution === undefined && RFunctionCall.isNamed(whatNode, AttachableLiterals)
		&& whatNode.arguments.every(a => a !== EmptyArgument && a.name !== undefined && a.value !== undefined) ? whatNode.arguments as readonly RArgument<OtherInfo & ParentInformation>[] : undefined;
	/* a data set R ships (`attach(mtcars)`) binds its columns */
	const dataset = envirResolution === undefined && listed === undefined && RSymbol.is(whatNode) && Resolve.byName(whatNode.content, data.environment)?.every(d => NodeId.isBuiltIn(d.nodeId)) !== false
		? datasetShape(Identifier.getName(whatNode.content)) : undefined;
	if(!envirResolution && !listed && !dataset) {
		bindsUnknownNames(result.graph, result.environment, rootId);
		return result;
	}

	/* build the attached layer with the env's known bindings */
	const injected: NamedInGraphIdentifierDefinition[] = [];
	for(const entry of listed ?? []) {
		const at = (entry.value as RNodeWithParent).info.id;
		injected.push({ nodeId: at, name: entry.name?.content as Identifier, type: ReferenceType.Variable, definedAt: rootId, cds: data.cds ? [...data.cds] : undefined });
		result.graph.addEdge(at, rootId, EdgeType.Reads);
	}
	for(const column of dataset?.columns ?? []) {
		const at = (whatNode as RSymbol<OtherInfo & ParentInformation>).info.id;
		injected.push({ nodeId: at, name: column, type: ReferenceType.Variable, definedAt: rootId, cds: data.cds ? [...data.cds] : undefined });
		result.graph.addEdge(at, rootId, EdgeType.Reads);
	}
	for(const [varName, varDefs] of envirResolution?.envDef.envState.current.memory ?? []) {
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
	/* R reports the names that are already bound (`The following object is masked _by_ .GlobalEnv`), so the call reads what they are bound to */
	for(const { name: bound } of injected) {
		for(const masking of Resolve.byName(bound, data.environment) ?? []) {
			if(!NodeId.isBuiltIn(masking.nodeId)) {
				result.graph.addEdge(rootId, masking.nodeId, EdgeType.Reads);
			}
		}
	}
	const attachedLayer = new Environment(result.environment.current).defineAll(injected);
	attachedLayer.t = EnvType.Attached;
	/* R names the entry by `name`, else by the variable given as `what` */
	const named = RArgument.valueOf(args.find(a => a !== EmptyArgument && a.name !== undefined && Identifier.getName(a.name.content) === 'name'));
	attachedLayer.n = RString.is(named) ? named.content.str : RSymbol.is(whatNode) ? Identifier.getName(whatNode.content) : undefined;

	/* R attaches below `.GlobalEnv`, so existing global bindings shadow the attached ones */
	return { ...result, environment: {
		current: REnvironment.attachAt(result.environment.current, attachedLayer, attachedLayer),
		level:   result.environment.level
	} };
}

/**
 * Processes `detach(name)` and `unloadNamespace(ns)`: the search path entry named (`package:x`, `"x"`, a position, the
 * topmost one if nothing is given) is removed, uncovering what it masked. The entry is read with the keys of the
 * call's search path {@link BuiltInFnInfo|ambient} write.
 */
export function processDetach<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: BuiltInFnInfo = {}
): DataflowInformation {
	const info = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Detach }).information;
	const keys = Ambient.list(config.ambient).flatMap(a => typeof a.member === 'object' ? keysOf(a.member, args, data) : []);
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
