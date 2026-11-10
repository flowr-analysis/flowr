import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { EnvType, REnvironment, SearchPathPackagePrefix, type Environment, type REnvironmentInformation } from '../../../../../environments/environment';
import { DfgVertex } from '../../../../../graph/vertex';
import { RFunctionCall, EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { StackEnvBuiltins, StackEnvKind } from '../../../../../environments/default-builtin-config';
import { type BrandedIdentifier, Identifier, ReferenceType } from '../../../../../environments/identifier';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RNumber } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RUnaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';

/** The context needed to resolve a stack env: the current environment (for the global) and the built-in environment. */
type StackEnvContext = Pick<DataflowProcessorInformation<never>, 'environment' | 'ctx'>;

/** The rlang pronoun for the scope surrounding a data mask. */
const EnvPronoun = '.env';

/** The stack env kind a builtin/constant `name` denotes, or `undefined`. */
function stackEnvKind(name: BrandedIdentifier): StackEnvKind | undefined {
	return (StackEnvBuiltins as Readonly<Record<BrandedIdentifier, StackEnvKind>>)[name];
}

/** Processes the env-returning builtins (`globalenv`/`baseenv`/`emptyenv`), tagging the call with the {@link BuiltInProcName.StackEnv} origin so an assignment (`e <- globalenv()`) attaches the stack env as the variable's `envState`. */
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

/** The kind of stack environment `node` denotes, if it does; a user definition of the same name shadows the built-in. */
export function stackEnvKindOf<Info>(node: RNode<Info> | undefined, data: Pick<StackEnvContext, 'environment'>): StackEnvKind | undefined {
	const symbol = RSymbol.is(node) ? node.content
		: RFunctionCall.calledName(node);
	const kind = symbol !== undefined ? stackEnvKind(Identifier.getName(symbol)) : undefined;
	if(kind === undefined || !Resolve.isBuiltIn(symbol as Identifier, data.environment, RSymbol.is(node) ? ReferenceType.Constant : ReferenceType.Function)) {
		return undefined;
	}
	/* `sys.frame(0)` numbers the global frame, `parent.frame(2)` is the caller's caller, which no kind names */
	return kind !== StackEnvKind.CallerFrame || namesDirectCaller(node) ? kind : numbersGlobalFrame(node) ? StackEnvKind.Global : undefined;
}

/** Whether `sys.frame` as `node` is handed the frame number 0, the global frame, or no number at all. */
function numbersGlobalFrame<Info>(node: RNode<Info> | undefined): boolean {
	if(!RFunctionCall.isNamed(node, 'sys.frame') || node.arguments.length > 1) {
		return false;
	}
	const which = node.arguments[0];
	return which === undefined || constantOf(valueOf(which)) === 0;
}

/** Whether `node` calls a built-in returning an environment of the stack, whichever one it is (`environment(f)`, `sys.frame(n)`). */
export function returnsStackEnv<Info>(node: RNode<Info> | undefined, data: Pick<StackEnvContext, 'environment'>): boolean {
	const name = RFunctionCall.calledName(node);
	return name !== undefined && stackEnvKind(Identifier.getName(name)) !== undefined && Resolve.isBuiltIn(name, data.environment, ReferenceType.Function);
}

/** Whether `parent.frame` as `node` is handed no generation count or the count 1, or `sys.frame` the count -1. */
function namesDirectCaller<Info>(node: RNode<Info> | undefined): boolean {
	return callerGenerationsOf(node) === 1;
}

/** How many calls up `parent.frame(n)`, `sys.frame(-n)` or `sys.frame(sys.parent(n))` as `node` looks, with a constant `n`. */
export function callerGenerationsOf<Info>(node: RNode<Info> | undefined): number | undefined {
	const [n, ...rest] = RFunctionCall.is(node) ? node.arguments : [];
	const value = valueOf(n);
	const called = RFunctionCall.calledName(node);
	const sysFrame = called !== undefined && Identifier.getName(called) === 'sys.frame';
	/* `sys.parent(n)` numbers the frame `parent.frame(n)` is */
	const parent = sysFrame && RFunctionCall.isNamed(value, 'sys.parent') && value.arguments.length <= 1 ? value : undefined;
	const count = constantOf(parent === undefined ? value : valueOf(parent.arguments[0]));
	const generations = parent !== undefined ? (parent.arguments.length === 0 ? 1 : count) : sysFrame ? (count === undefined ? undefined : -count) : n === undefined ? 1 : count;
	return rest.length === 0 && generations !== undefined && Number.isInteger(generations) && generations >= 1 ? generations : undefined;
}

function valueOf<Info>(arg: PotentiallyEmptyRArgument<Info> | undefined): RNode<Info> | undefined {
	return arg === undefined || arg === EmptyArgument ? undefined : arg.value;
}

/** The number `node` is, negated or not. */
function constantOf<Info>(node: RNode<Info> | undefined): number | undefined {
	const negated = RUnaryOp.is(node) && node.operator === '-' ? node.operand : undefined;
	return RNumber.is(node) ? node.content.num : RNumber.is(negated) ? -negated.content.num : undefined;
}

/** The stack environment an AST `node` denotes directly: a `.GlobalEnv`/`.BaseEnv` symbol, a `globalenv()`/`baseenv()`/`emptyenv()` call, the current env via `environment()`, the parent via `parent.env(e)`, or a named search-path entry via `as.environment("package:x")`. */
export function resolveNodeToStackEnv<Info>(node: RNode<Info> | undefined, data: StackEnvContext): REnvironmentInformation | undefined {
	const kind = stackEnvKindOf(node, data);
	if(kind === undefined) {
		return undefined;
	}
	const firstArg = RFunctionCall.is(node) && node.arguments.length > 0 && node.arguments[0] !== EmptyArgument ? node.arguments[0].value : undefined;
	switch(kind) {
		case StackEnvKind.Global: case StackEnvKind.Base: case StackEnvKind.Empty:
			return fixedStackEnv(kind, data);
		case StackEnvKind.CallerFrame: // parent.frame(): the caller's frame, over-approximated to global (exact at a top-level call)
			return fixedStackEnv(StackEnvKind.Global, data);
		case StackEnvKind.Current: // environment() with no argument is the current environment, `environment(sys.function())` the one the function is defined in
			if(firstArg === undefined) {
				return { current: data.environment.current, level: data.environment.level };
			}
			return RFunctionCall.isNamed(firstArg, 'sys.function') && firstArg.arguments.length === 0 && Resolve.isBuiltIn(firstArg.functionName.content, data.environment, ReferenceType.Function)
				? definingFrame(data.environment) : undefined;
		case StackEnvKind.Parent: {
			const inner = resolveNodeToStackEnv(firstArg, data);
			return inner !== undefined && !inner.current.builtInEnv ? { current: inner.current.parent, level: inner.level } : undefined;
		}
		case StackEnvKind.Named:
			return RString.is(firstArg) ? asSearchPathEnv(firstArg.content.str, data) : undefined;
	}
}

/** The frame the function running in `environment` is defined in, if it runs in one. */
function definingFrame(environment: REnvironmentInformation): REnvironmentInformation | undefined {
	let frame = environment.current;
	while(frame.closure === undefined && !frame.globalEnv && !frame.builtInEnv) {
		frame = frame.parent;
	}
	return frame.closure === undefined ? undefined : { current: frame.parent, level: environment.level };
}

/** Resolves a named search-path entry: a `.GlobalEnv`/`.BaseEnv` name, or `package:<name>` to that package's namespace layer. */
function asSearchPathEnv(name: string, data: StackEnvContext): REnvironmentInformation | undefined {
	const fixed = fixedStackEnv(stackEnvKind(name), data);
	if(fixed !== undefined) {
		return fixed;
	}
	if(name.startsWith(SearchPathPackagePrefix)) {
		const pkg = name.slice(SearchPathPackagePrefix.length);
		for(const env of REnvironment.searchPath(data.environment.current)) {
			if(env.n === pkg && env.t === EnvType.Namespace) {
				return { current: env, level: 0 };
			}
		}
	}
	return undefined;
}

/** The stack environment `sourceInfo`'s value comes from (`e <- globalenv()`, `e <- environment()`), or `undefined`. */
export function stackEnvStateFromSource(sourceInfo: DataflowInformation, data: StackEnvContext, entryPoint: NodeId | undefined = sourceInfo.entryPoint): REnvironmentInformation | undefined {
	const vertex = entryPoint === undefined ? undefined : sourceInfo.graph.getVertex(entryPoint);
	if(!DfgVertex.isFunctionCall(vertex) || vertex.name === undefined) {
		return undefined;
	}
	const kind = stackEnvKind(Identifier.getName(vertex.name));
	if(DfgVertex.hasOrigin(vertex, BuiltInProcName.StackEnv)) {
		return fixedStackEnv(kind, data);
	}
	/* `environment()` goes through the default processor; with an argument it denotes a closure's env instead */
	return kind === StackEnvKind.Current && vertex.args.length === 0 && DfgVertex.hasOrigin(vertex, BuiltInProcName.Default)
		? { current: data.environment.current, level: data.environment.level }
		: undefined;
}

/** Whether `envState` is the frame of a function around the current one, which the body sees emptied (see {@link Environment#superMemory}): a write there binds as `<<-` does, a read there reads the name as a free variable of the body. */
export function isEnclosingFrame(envState: REnvironmentInformation): boolean {
	return envState.current.superMemory !== undefined && envState.current.globalEnv !== true;
}

/** The global frame or that of a function around the current one `node` denotes (`sys.frame(0)`, `parent.env(environment())`, `environment(sys.function())`), see {@link isEnclosingFrame}. */
export function frameNamedBy<Info>(node: RNode<Info> | undefined, data: StackEnvContext): REnvironmentInformation | undefined {
	const frame = resolveNodeToStackEnv(node, data);
	return frame !== undefined && (frame.current.globalEnv === true || isEnclosingFrame(frame)) ? frame : undefined;
}

/** Whether a `$`/`[[` on the stack env `node` denotes reads through the enclosing scopes. */
export function stackEnvInheritsFields<Info>(node: RNode<Info> | undefined): boolean {
	return RSymbol.is(node) && Identifier.getName(node.content) === EnvPronoun;
}
