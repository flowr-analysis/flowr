import { EmptyArgument, RFunctionCall, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { processKnownFunctionCall } from '../known-call-handling';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { resolveListToEnvState } from './built-in-list';
import { findReturnsEnvState } from './built-in-envir-utils';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import { ReferenceType } from '../../../../../environments/identifier';

/** The arguments that carry a class generator's methods: R6's `public`, Reference Class's `methods`. */
const MethodListArguments = ['public', 'methods'];

/**
 * Processes an `R6Class(...)` / `setRefClass(...)` generator call. It stays an ordinary call; the origin lets the
 * assignment layer record its `public`/`methods` list as the `returnsEnvState` an eventual `$new()` instance carries.
 */
export function processClassGenerator<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.ClassGenerator }).information;
}

/**
 * The method environment a class generator's `$new()` instances expose: the named function entries of its
 * `public`/`methods` `list(...)` argument, recorded as a resolvable pseudo-env (reusing {@link resolveListToEnvState}).
 * `undefined` when no method list is present.
 */
export function resolveClassMethodsToEnvState<OtherInfo>(
	source: RNode<OtherInfo & ParentInformation>,
	data:   Pick<DataflowProcessorInformation<never>, 'environment'>
): REnvironmentInformation | undefined {
	if(!RFunctionCall.isNamed(source)) {
		return undefined;
	}
	const methodList = source.arguments.find(arg => arg !== EmptyArgument && arg.name !== undefined && MethodListArguments.includes(arg.name.content));
	return methodList && methodList !== EmptyArgument && methodList.value !== undefined ? resolveListToEnvState(methodList.value, data) : undefined;
}

/**
 * The method environment an instance from `<Cls>$new(...)` carries: if `source` is such a constructor call and the
 * generator `<Cls>` was recorded with a method `returnsEnvState` (see {@link resolveClassMethodsToEnvState}), that env;
 * else `undefined`. Lets a later `instance$method()` resolve to the generator's method definition.
 */
export function resolveConstructorInstanceEnvState<OtherInfo>(
	source: RNode<OtherInfo & ParentInformation>,
	data:   Pick<DataflowProcessorInformation<never>, 'environment'>
): REnvironmentInformation | undefined {
	if(source.type !== RType.FunctionCall || source.named) {
		return undefined;
	}
	const callee = source.calledFunction;
	if(callee.type !== RType.Access || callee.operator !== '$' || callee.accessed.type !== RType.Symbol) {
		return undefined;
	}
	const field = callee.access[0]?.value;
	if(field === undefined || field.lexeme !== 'new') {
		return undefined;
	}
	return findReturnsEnvState(resolveByName(callee.accessed.content, data.environment, ReferenceType.Variable));
}
