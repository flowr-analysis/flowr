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
import { ReferenceType } from '../../../../../environments/identifier';
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

/** Records a `list(...)`'s named function entries as a resolvable pseudo-env, so `d$foo(...)`/`d[["foo"]](...)` link to them; `undefined` if none. */
export function resolveListToEnvState<OtherInfo>(
	source: RNode<OtherInfo & ParentInformation>,
	data:   Pick<DataflowProcessorInformation<never>, 'environment'>
): REnvironmentInformation | undefined {
	if(!RFunctionCall.isNamed(source)) {
		return undefined;
	}
	let envState = pushLocalEnvironment(data.environment);
	let found = false;
	for(const arg of source.arguments) {
		if(RArgument.isEmpty(arg) || arg.name === undefined || arg.value === undefined) {
			continue;
		}
		const value = arg.value;
		const isFn = RFunctionDefinition.is(value)
			|| (RSymbol.is(value) && (Resolve.byNameAndType(value.content, data.environment, ReferenceType.Function)?.length ?? 0) > 0);
		if(!isFn) {
			continue;
		}
		envState = define({
			type:      ReferenceType.Function,
			name:      arg.name.content,
			nodeId:    value.info.id,
			definedAt: value.info.id,
			cds:       undefined
		}, false, envState);
		found = true;
	}
	return found ? envState : undefined;
}
