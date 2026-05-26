import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { pushLocalEnvironment } from '../../../../../environments/scoping';
import { Environment, type REnvironmentInformation } from '../../../../../environments/environment';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { unpackArg } from '../argument/unpack-argument';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import { type InGraphIdentifierDefinition, ReferenceType } from '../../../../../environments/identifier';
import { VertexType } from '../../../../../graph/vertex';
import type { DataflowGraphVertexFunctionCall } from '../../../../../graph/vertex';
import { RNull } from '../../../../../../r-bridge/lang-4.x/convert-values';

/** R function names that signal "use the empty/terminal R environment" as parent */
const EmptyParentEnvFunctions = new Set(['emptyenv', 'baseenv']);

/**
 * Processes `new.env()`, `new.environment()`, and `rlang::new_environment()`.
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
		if(parentState !== undefined) {
			const vertex = result.graph.getVertex(rootId);
			if(vertex?.tag === VertexType.FunctionCall) {
				(vertex as DataflowGraphVertexFunctionCall).newEnvParent = parentState;
			}
		}
	}

	return result;
}

/**
 * Scans `args` for the `parent` argument of a `new.env()`-family call and returns the
 * {@link REnvironmentInformation} that should serve as the parent of the newly-created
 * environment, or `undefined` when no static resolution is possible (caller falls back to
 * {@link createFreshEnvState} default which uses the current execution environment).
 *
 * Recognised patterns:
 * - `parent = <tracked-env-var>` — returns that variable's `envState`
 * - `parent = emptyenv()` / `parent = baseenv()` — returns an isolated env (no user scope)
 * - `parent = NULL` — same as `emptyenv()`
 * - everything else — `undefined` (fall through)
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
				return createIsolatedEnvState(data);
			}
			const defs = resolveByName(node.content, data.environment, ReferenceType.Variable);
			if(defs?.length === 1) {
				const def = defs[0] as InGraphIdentifierDefinition;
				if(def.envState) {
					return def.envState;
				}
			}
		} else if(RFunctionCall.isNamed(node) && node.functionName.type === RType.Symbol) {
			if(EmptyParentEnvFunctions.has(node.functionName.content as string)) {
				return createIsolatedEnvState(data);
			}
		}
		return undefined;
	}
	return undefined;
}

/**
 * Creates an isolated (empty-parent) env state: the new environment's only
 * parent is the built-in environment, matching R's `emptyenv()` semantics.
 */
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
 * to `parent = parent.frame()` — i.e. uses the current execution environment as parent.
 */
export function createFreshEnvState(
	data:       Pick<DataflowProcessorInformation<never>, 'environment'>,
	sourceInfo?: DataflowInformation
): REnvironmentInformation {
	if(sourceInfo !== undefined) {
		const vertex = sourceInfo.graph.getVertex(sourceInfo.entryPoint);
		if(vertex?.tag === VertexType.FunctionCall && (vertex as DataflowGraphVertexFunctionCall).newEnvParent !== undefined) {
			const parentState = (vertex as DataflowGraphVertexFunctionCall).newEnvParent!;
			return {
				current: new Environment(parentState.current),
				level:   parentState.level + 1
			};
		}
	}
	return pushLocalEnvironment(data.environment);
}
