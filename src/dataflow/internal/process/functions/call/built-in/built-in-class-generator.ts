import { RFunctionCall, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
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
import { ReferenceType } from '../../../../../environments/identifier';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ClassDeclarationConfig } from '../../../../../fn/class-declaration';
import { attachClassDeclaration } from './built-in-s-seven-new-generic';

/** R6's `public` / Reference Class's `methods` argument carrying the class generator's methods. */
const MethodListArguments = ['public', 'methods'];

/** Processes an `R6Class`/`setRefClass` generator call, tagging it so the assignment layer can record its method list. */
export function processClassGenerator<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config?: { readonly classDecl?: ClassDeclarationConfig }
): DataflowInformation {
	const info = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.ClassGenerator }).information;
	attachClassDeclaration(info, rootId, args, config?.classDecl);
	return info;
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
	if(!RFunctionCall.is(source) || source.named) {
		return undefined;
	}
	const callee = source.calledFunction;
	if(!RAccess.is(callee) || (callee.operator !== '$' && callee.operator !== '[[') || !RSymbol.is(callee.accessed)) {
		return undefined;
	}
	const field = RArgument.isEmpty(callee.access[0]) ? undefined : callee.access[0]?.value;
	const fieldName = RString.is(field) ? field.content.str : field?.lexeme;
	if(fieldName !== ConstructorField) {
		return undefined;
	}
	return findReturnsEnvState(Resolve.byNameAndType(callee.accessed.content, data.environment, ReferenceType.Variable));
}
