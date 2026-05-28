import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, RFunctionCall, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { pushLocalEnvironment } from '../../../../../environments/scoping';
import { Environment, type REnvironmentInformation } from '../../../../../environments/environment';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { unpackArg } from '../argument/unpack-argument';
import { isFunctionCallVertex } from '../../../../../graph/vertex';
import { RNull } from '../../../../../../r-bridge/lang-4.x/convert-values';
import { resolveSymbolToEnvir } from './built-in-envir-utils';

const EmptyParentEnvFunctions = new Set(['emptyenv', 'baseenv']);

/**
 * Processes `new.env()` and `rlang::new_environment()`.
 *
 * The resulting function-call vertex carries the {@link BuiltInProcName.NewEnv} origin so that
 * `processAssignment` can detect it and attach an `envState` to the assigned variable.
 *
 * When the `parent` argument can be statically resolved (a tracked env variable or an
 * `emptyenv()`-family call), the resolved parent is stored in the vertex's `newEnvParent`
 * field so that {@link createFreshEnvState} can use it.
 */
export function processNewEnv<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	const result = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.NewEnv }).information;

	if(data.ctx.config.solver.trackEnvironments) {
		const parentState = resolveNewEnvParentArg(args, data);
		const vertex = result.graph.getVertex(rootId);
		if(parentState !== undefined && isFunctionCallVertex(vertex)) {
			vertex.newEnvParent = parentState;
		}
	}

	return result;
}

/**
 * Scans `args` for the `parent` argument and returns the {@link REnvironmentInformation}
 * to use as the parent of the newly-created environment, or `undefined` to fall through
 * to the default (current execution environment).
 *
 * Recognised patterns:
 * - `parent = <tracked-env-var>` - returns that variable's `envState`
 * - `parent = emptyenv()` / `parent = baseenv()` - returns an isolated env (no user scope)
 * - everything else - `undefined` (fall through)
 */
function resolveNewEnvParentArg<OtherInfo>(
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): REnvironmentInformation | undefined {
	for(const arg of args) {
		if(arg === EmptyArgument || arg.name?.content !== 'parent') {
			continue;
		}
		const node = unpackArg(arg);
		if(!node) {
			return undefined;
		}
		if(node.type === RType.Symbol) {
			if(node.content === RNull) {
				return undefined;
			}
			return resolveSymbolToEnvir(node.content, node.info.id, data)?.envDef.envState;
		}
		if(RFunctionCall.isNamed(node) && node.functionName.type === RType.Symbol
				&& EmptyParentEnvFunctions.has(node.functionName.content as string)) {
			return createIsolatedEnvState(data);
		}
		return undefined;
	}
	return undefined;
}

function createIsolatedEnvState(data: Pick<DataflowProcessorInformation<never>, 'environment'>): REnvironmentInformation {
	let root = data.environment.current;
	while(!root.builtInEnv) {
		root = root.parent;
	}
	return { current: new Environment(root), level: 0 };
}

/**
 * Creates the initial (empty) environment state for a freshly created `new.env()`.
 *
 * When called from `processAssignmentToSymbol`, pass `sourceInfo` so that a
 * statically-resolved `parent` argument (stored in the vertex's `newEnvParent` field)
 * is honoured.  Without `sourceInfo` (or when no `newEnvParent` is present), falls back
 * to the current execution environment as parent.
 */
export function createFreshEnvState(
	data:       Pick<DataflowProcessorInformation<never>, 'environment'>,
	sourceInfo?: DataflowInformation
): REnvironmentInformation {
	if(sourceInfo !== undefined) {
		const vertex = sourceInfo.graph.getVertex(sourceInfo.entryPoint);
		if(isFunctionCallVertex(vertex) && vertex.newEnvParent !== undefined) {
			return {
				current: new Environment(vertex.newEnvParent.current),
				level:   vertex.newEnvParent.level + 1
			};
		}
	}
	return pushLocalEnvironment(data.environment);
}
