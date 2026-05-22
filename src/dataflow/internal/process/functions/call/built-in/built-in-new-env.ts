import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Environment } from '../../../../../environments/environment';

/**
 * Processes `new.env()` and related environment-creation functions.
 *
 * The resulting function-call vertex carries the {@link BuiltInProcName.NewEnv} origin so that
 * `processAssignment` can detect it and attach an `envState` to the assigned variable.
 */
export function processNewEnv<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.NewEnv }).information;
}

/**
 * Creates the initial (empty) environment state for a freshly created `new.env()`.
 * The parent is the current environment's scope, matching R's default `parent = parent.frame()`.
 */
export function createFreshEnvState(data: Pick<DataflowProcessorInformation<never>, 'environment'>) {
	return {
		current: new Environment(data.environment.current),
		level:   0 as const
	};
}
