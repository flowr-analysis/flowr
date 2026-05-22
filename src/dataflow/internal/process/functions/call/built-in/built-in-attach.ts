
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
import { ReferenceType, type InGraphIdentifierDefinition, type IdentifierDefinition, type Identifier } from '../../../../../environments/identifier';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import { define } from '../../../../../environments/define';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';

/**
 * Processes `attach(what, ...)` — when `what` is a variable that holds a tracked
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

	/* first positional arg is the object to attach */
	const whatArg = args.length >= 1 ? args[0] : undefined;
	const whatNode = whatArg && whatArg !== EmptyArgument ? unpackArg(whatArg) : undefined;

	if(whatNode?.type !== RType.Symbol) {
		/* can't track statically — mark as unknown side effect */
		handleUnknownSideEffect(result.graph, result.environment, rootId);
		return result;
	}

	const defs = resolveByName(whatNode.content, data.environment, ReferenceType.Variable);
	if(!defs || defs.length !== 1) {
		handleUnknownSideEffect(result.graph, result.environment, rootId);
		return result;
	}

	const envDef = defs[0] as InGraphIdentifierDefinition;
	if(!envDef.envState) {
		/* variable exists but is not a tracked env — treat conservatively */
		handleUnknownSideEffect(result.graph, result.environment, rootId);
		return result;
	}

	/* inject every statically-known variable from the attached env into the current scope */
	let newEnvironment = result.environment;
	for(const [varName, varDefs] of envDef.envState.current.memory) {
		for(const varDef of varDefs) {
			const injected: IdentifierDefinition & { name: Identifier } = {
				...(varDef as InGraphIdentifierDefinition),
				name: varName as Identifier,
				type: ReferenceType.Variable,
			};
			newEnvironment = define(injected as InGraphIdentifierDefinition & { name: Identifier }, false, newEnvironment);
		}
	}

	return { ...result, environment: newEnvironment };
}
