import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { unpackArg } from '../argument/unpack-argument';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall, EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { InGraphIdentifierDefinition, NamedInGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { EdgeType } from '../../../../../graph/edge';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { envirOf, resolveEnvirArgOrAmbiguous, resolveFirstEnvirArg, routeWrittenToEnvir, unknownIfAmbiguous } from './built-in-envir-utils';
import type { FnSig } from '../../../../../environments/built-in-props';
import { Resolve } from '../../../../../environments/resolve-helper';
import { define } from '../../../../../environments/define';

/**
 * Processes a call listing what an environment holds (`ls`, `objects`), which reads every binding in it: the
 * answer changes with each one, so each has to stay.
 */
export function processEnvContents<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { sig?: FnSig } = {}
): DataflowInformation {
	const result = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.EnvContents }).information;

	/* `ls(name)` takes the environment in its first formal, `ls(envir = e)` in the one named for it */
	const resolution = resolveFirstEnvirArg(args, data, config.sig, ['envir', 'name']);
	if(!resolution) {
		return result;
	}
	for(const defs of resolution.envDef.envState.current.memory.values()) {
		for(const def of defs as readonly InGraphIdentifierDefinition[]) {
			result.graph.addEdge(rootId, def.nodeId, EdgeType.Reads);
			if(def.definedAt !== undefined && def.definedAt !== def.nodeId) {
				result.graph.addEdge(rootId, def.definedAt, EdgeType.Reads);
			}
		}
	}
	return result;
}

/** The `list(...)` call a node stands for, following a variable to the literal it was assigned. */
function listLiteralOf<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation> | undefined,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): RFunctionCall<OtherInfo & ParentInformation> | undefined {
	if(RFunctionCall.isNamed(node) && Identifier.getName(node.functionName.content) === 'list'
		&& Resolve.isBuiltIn(node.functionName.content, data.environment, ReferenceType.Function)) {
		return node;
	}
	if(!RSymbol.is(node)) {
		return undefined;
	}
	for(const def of Resolve.byNameAndType(node.content, data.environment, ReferenceType.Variable) ?? []) {
		for(const value of (def as InGraphIdentifierDefinition).value ?? []) {
			const literal = listLiteralOf(data.completeAst.idMap.get(value), data);
			if(literal !== undefined) {
				return literal;
			}
		}
	}
	return undefined;
}

/**
 * Processes `list2env(x, envir)`, which binds each named element of the list in the target environment; an
 * unresolvable list leaves the call with an unknown side effect rather than with no effect at all.
 */
export function processListToEnv<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { sig?: FnSig } = {}
): DataflowInformation {
	const result = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.ListToEnv }).information;

	const envirRouting = resolveEnvirArgOrAmbiguous(args, data, config.sig);
	if(unknownIfAmbiguous(envirRouting, result, rootId)) {
		return result;
	}

	const first = args.length >= 1 && args[0] !== EmptyArgument ? unpackArg(args[0]) : undefined;
	const literal = listLiteralOf(first, data);
	if(literal === undefined) {
		handleUnknownSideEffect(result.graph, result.environment, rootId);
		return result;
	}

	const written: NamedInGraphIdentifierDefinition[] = [];
	for(const arg of literal.arguments) {
		if(RArgument.isEmpty(arg) || arg.name === undefined || arg.value === undefined) {
			continue;
		}
		written.push({
			type:      ReferenceType.Variable,
			name:      arg.name.content,
			nodeId:    arg.info.id,
			definedAt: rootId,
			cds:       data.cds
		});
		/* the binding is defined by its value and by the call, so reading it keeps the `list2env` call itself */
		result.graph.addEdge(arg.info.id, arg.value.info.id, EdgeType.DefinedBy);
		result.graph.addEdge(arg.info.id, rootId, EdgeType.DefinedBy);
		result.graph.addEdge(rootId, arg.value.info.id, EdgeType.Reads);
	}
	if(written.length === 0) {
		handleUnknownSideEffect(result.graph, result.environment, rootId);
		return result;
	}

	let environment = result.environment;
	for(const definition of written) {
		environment = define(definition, false, environment);
	}
	const defined = { ...result, environment, out: [...result.out, ...written] };

	/* a target environment of its own (stack frame or custom env) takes the bindings instead of current scope */
	const envirResolution = envirOf(envirRouting);
	return envirResolution ? routeWrittenToEnvir(defined, envirResolution, rootId, data.environment, rootId) : defined;
}
