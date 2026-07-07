import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { EnvType, REnvironment, type Environment, type REnvironmentInformation } from '../../../../../environments/environment';
import { isFunctionCallVertex } from '../../../../../graph/vertex';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { EmptyArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { StackEnvBuiltins, StackEnvKind } from '../../../../../environments/default-builtin-config';

/** The context needed to resolve a stack env: the current environment (for the global) and the built-in environment. */
type StackEnvContext = Pick<DataflowProcessorInformation<never>, 'environment' | 'ctx'>;

/** The stack env kind a builtin/constant `name` denotes, or `undefined`. */
function stackEnvKind(name: string): StackEnvKind | undefined {
	return (StackEnvBuiltins as Readonly<Record<string, StackEnvKind>>)[name];
}

/**
 * Processes the env-returning builtins (`globalenv`/`baseenv`/`emptyenv`), tagging the call with the
 * {@link BuiltInProcName.StackEnv} origin so an assignment (`e <- globalenv()`) attaches the stack env as the
 * variable's `envState`. Direct forms (`globalenv()$x`, `.GlobalEnv`) go through {@link resolveNodeToStackEnv}.
 */
export function processStackEnv<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.StackEnv }).information;
}

/** The fixed stack environment for a `Global`/`Base`/`Empty` kind; `undefined` for kinds that need the call's arguments. */
function fixedStackEnv(kind: StackEnvKind | undefined, data: StackEnvContext): REnvironmentInformation | undefined {
	switch(kind) {
		case StackEnvKind.Global:
			return { current: REnvironment.findGlobal(data.environment.current), level: 0 };
		case StackEnvKind.Base:
			return { current: data.ctx.env.builtInEnvironment as Environment, level: 0 };
		case StackEnvKind.Empty:
			return data.ctx.env.makeEmptyEnv();
		default:
			return undefined;
	}
}

/**
 * The stack environment an AST `node` denotes directly: a `.GlobalEnv`/`.BaseEnv` symbol, a
 * `globalenv()`/`baseenv()`/`emptyenv()` call, the current env via `environment()`, the parent via `parent.env(e)`,
 * or a named search-path entry via `as.environment("package:x")`. Returns `undefined` otherwise.
 */
export function resolveNodeToStackEnv<Info>(node: RNode<Info> | undefined, data: StackEnvContext): REnvironmentInformation | undefined {
	if(node === undefined) {
		return undefined;
	}
	const name = node.type === RType.Symbol ? String(node.content)
		: RFunctionCall.isNamed(node) && node.functionName.type === RType.Symbol ? String(node.functionName.content)
			: undefined;
	const kind = name !== undefined ? stackEnvKind(name) : undefined;
	if(kind === undefined) {
		return undefined;
	}
	const firstArg = node.type === RType.FunctionCall && node.arguments.length > 0 && node.arguments[0] !== EmptyArgument ? node.arguments[0].value : undefined;
	switch(kind) {
		case StackEnvKind.Global: case StackEnvKind.Base: case StackEnvKind.Empty:
			return fixedStackEnv(kind, data);
		case StackEnvKind.Current: // environment() with no argument is the current environment
			return firstArg === undefined ? { current: data.environment.current, level: data.environment.level } : undefined;
		case StackEnvKind.Parent: {
			const inner = resolveNodeToStackEnv(firstArg, data);
			return inner !== undefined && !inner.current.builtInEnv ? { current: inner.current.parent, level: inner.level } : undefined;
		}
		case StackEnvKind.Named:
			return firstArg?.type === RType.String ? asSearchPathEnv(firstArg.content.str, data) : undefined;
	}
}

/** Resolves a named search-path entry: a `.GlobalEnv`/`.BaseEnv` name, or `package:<name>` to that package's namespace layer. */
function asSearchPathEnv(name: string, data: StackEnvContext): REnvironmentInformation | undefined {
	const fixed = fixedStackEnv(stackEnvKind(name), data);
	if(fixed !== undefined) {
		return fixed;
	}
	if(name.startsWith('package:')) {
		const pkg = name.slice('package:'.length);
		for(let env: Environment | undefined = REnvironment.findGlobal(data.environment.current).parent; env !== undefined && !env.builtInEnv; env = env.parent) {
			if(env.n === pkg && env.t === EnvType.Namespace) {
				return { current: env, level: 0 };
			}
		}
	}
	return undefined;
}

/** If `sourceInfo`'s entry is a {@link BuiltInProcName.StackEnv} call, the stack environment it refers to; else `undefined`. */
export function stackEnvStateFromSource(sourceInfo: DataflowInformation, data: StackEnvContext): REnvironmentInformation | undefined {
	const vertex = sourceInfo.graph.getVertex(sourceInfo.entryPoint);
	if(!isFunctionCallVertex(vertex) || vertex.name === undefined || !vertex.origin.includes(BuiltInProcName.StackEnv)) {
		return undefined;
	}
	return fixedStackEnv(stackEnvKind(String(vertex.name)), data);
}
