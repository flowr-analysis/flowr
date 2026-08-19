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
import { ReferenceType } from '../../../../../environments/identifier';
import { Resolve } from '../../../../../environments/resolve-helper';

/** R6's `public` / Reference Class's `methods` argument carrying the class generator's methods. */
const MethodListArguments = ['public', 'methods'];

/** Processes an `R6Class`/`setRefClass` generator call, tagging it so the assignment layer can record its method list. */
export function processClassGenerator<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.ClassGenerator }).information;
}

/** The method env of a class generator's `public`/`methods` `list(...)` (via {@link resolveListToEnvState}); `undefined` if absent. */
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

const ConstructorField = 'new';

/** The method env an instance from `<Cls>$new(...)`/`<Cls>[["new"]](...)` carries, from the generator's recorded `returnsEnvState`; `undefined` otherwise. */
export function resolveConstructorInstanceEnvState<OtherInfo>(
	source: RNode<OtherInfo & ParentInformation>,
	data:   Pick<DataflowProcessorInformation<never>, 'environment'>
): REnvironmentInformation | undefined {
	if(source.type !== RType.FunctionCall || source.named) {
		return undefined;
	}
	const callee = source.calledFunction;
	if(callee.type !== RType.Access || (callee.operator !== '$' && callee.operator !== '[[') || callee.accessed.type !== RType.Symbol) {
		return undefined;
	}
	const field = callee.access[0] === EmptyArgument ? undefined : callee.access[0]?.value;
	const fieldName = field?.type === RType.String ? field.content.str : field?.lexeme;
	if(fieldName !== ConstructorField) {
		return undefined;
	}
	return findReturnsEnvState(Resolve.byNameAndType(callee.accessed.content, data.environment, ReferenceType.Variable));
}
