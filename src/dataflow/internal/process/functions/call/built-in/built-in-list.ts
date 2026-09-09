import {
	RFunctionCall,
	type PotentiallyEmptyRArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { processKnownFunctionCall } from '../known-call-handling';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import type { InGraphReferenceType } from '../../../../../environments/identifier';
import { define } from '../../../../../environments/define';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { pushLocalEnvironment } from '../../../../../environments/scoping';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';

/**
 * Process a list call.
 *
 * Example:
 * ```r
 * list(a = 1, b = 2)
 * ```
 */
export function processList<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.List }).information;
}

/** Whether `node` denotes a function: a definition written down, or a symbol that resolves to one in `environment`. */
export function holdsFunction<OtherInfo>(
	node:        RNode<OtherInfo & ParentInformation>,
	environment: REnvironmentInformation
): boolean {
	return RFunctionDefinition.is(node)
		|| (RSymbol.is(node) && (Resolve.byNameAndType(node.content, environment, ReferenceType.Function)?.length ?? 0) > 0);
}

/**
 * Records a `list(...)`'s entries as a resolvable pseudo-env, so `d$foo(...)`, `d[["foo"]](...)` and `d[[1]](...)`
 * link to them; `undefined` if none. An entry is reachable under its name and, since R numbers list entries as
 * they are written, under its position as well. By default only the entries holding a function are recorded,
 * which is what makes a call through the container resolve; `values` records the rest too.
 */
export function resolveListToEnvState<OtherInfo>(
	source: RNode<OtherInfo & ParentInformation>,
	data:   Pick<DataflowProcessorInformation<never>, 'environment'>,
	values  = false
): REnvironmentInformation | undefined {
	if(!RFunctionCall.isNamed(source)) {
		return undefined;
	}
	let envState = pushLocalEnvironment(data.environment);
	let found = false;
	let position = 0;
	for(const arg of source.arguments) {
		position++;
		if(RArgument.isEmpty(arg) || arg.value === undefined) {
			continue;
		}
		const value = arg.value;
		const isFn = holdsFunction(value, data.environment);
		if(!isFn && !values) {
			continue;
		}
		const definition = {
			type:      isFn ? ReferenceType.Function : ReferenceType.Variable as InGraphReferenceType,
			nodeId:    value.info.id,
			definedAt: value.info.id,
			cds:       undefined
		};
		for(const name of [arg.name?.content, Identifier.make(String(position))]) {
			if(name !== undefined) {
				envState = define({ ...definition, name }, false, envState);
			}
		}
		found = true;
	}
	return found ? envState : undefined;
}
