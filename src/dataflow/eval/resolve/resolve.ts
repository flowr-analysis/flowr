import { RFunctionCall, EmptyArgument  } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RValue } from '../values/r-value';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RNumberValue } from '../../../r-bridge/lang-4.x/convert-values';
import { isRNumberValue, unliftRValue } from '../../../util/r-value';
import type { BuiltInEvalHandler, BuiltInEvalHandlerArgs } from '../../environments/built-in';
import { OriginType } from '../../origin/dfg-get-origin';
import { ValueLogicalFalse, ValueLogicalTrue } from '../values/logical/logical-constants';
import { type Lift, Top, type Value, type ValueNumber, type ValueVector } from '../values/r-value';
import { flattenVectorElements, vectorFrom } from '../values/vectors/vector-constants';
import { valueFromRNumber } from '../values/general';
import { liftScalar } from '../values/scalar/scalar-constants';
import { Identifier, type IdentifierDefinition, ReferenceType } from '../../environments/identifier';
import type { REnvironmentInformation } from '../../environments/environment';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { Dataflow } from '../../graph/df-helper';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Resolve } from '../../environments/resolve-helper';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';

/**
 * The {@link BuiltInEvalHandler} the given name resolves to in the current environment, just like the
 * {@link BuiltInIdentifierDefinition#processor} a call resolves to; `undefined` if the name is shadowed
 * by a user definition or its built-in declares no handler.
 */
function evalHandlerOf(name: Identifier, environment: REnvironmentInformation | undefined, ctx: ReadOnlyFlowrAnalyzerContext): BuiltInEvalHandler | undefined {
	const defs = environment ?
		Resolve.byNameAndType(name, environment, ReferenceType.BuiltInFunction)
		/* without an environment the search path is unknown, so what a package states about the name has its say */
		: ctx.env.builtInEnvironment.memory.get(Identifier.getName(name)) as IdentifierDefinition[] | undefined
			?? ctx.env.statedDefinitionsOf(name);
	const def = defs?.length === 1 ? defs[0] : undefined;
	return def?.type === ReferenceType.BuiltInFunction ? def.evalHandler : undefined;
}

/** the node types that may fold through a built-in: calls, operators, and the `(`/`{` groupings */
const EvalNodeTypes: readonly RType[] = [RType.FunctionCall, RType.BinaryOp, RType.UnaryOp, RType.ExpressionList];

/**
 * The name of the built-in the given node folds through, `undefined` if it is no call to one or if it may just
 * as well resolve to something else (a user redefinition, a conditional one, ...), which must not be folded.
 */
function evalNameOf({ node, graph }: BuiltInEvalHandlerArgs): Identifier | undefined {
	if(graph === undefined || !EvalNodeTypes.includes(node.type)) {
		return undefined;
	}
	let name: Identifier | undefined;
	for(const origin of Dataflow.origin(graph, node.info.id) ?? []) {
		if(origin.type === OriginType.FunctionCallOrigin || origin.type === OriginType.WriteVariableOrigin) {
			/* the call may go to a definition of the program instead, so we know too little to fold it */
			return undefined;
		} else if(origin.type !== OriginType.BuiltInFunctionOrigin) {
			continue;
		}
		/* an alias like `f <- c` keeps the built-in it stands for in `proc`, a direct call names itself */
		const pkgFn = NodeId.toPkgFn(origin.proc);
		const named = pkgFn !== undefined ? Identifier.make(pkgFn[1], pkgFn[0])
			: NodeId.isBuiltIn(origin.proc) ? NodeId.fromBuiltIn(origin.proc) : origin.fn.name;
		if(name !== undefined && Identifier.getName(name) !== Identifier.getName(named)) {
			return undefined;
		}
		/* the same call is named bare by one origin and qualified by another; the qualified one says whose it is */
		name = name !== undefined && Identifier.getNamespace(named) === undefined ? name : named;
	}
	return name;
}

/**
 * Converts an RNode to its Value, either directly for a constant or by handing the node to the
 * {@link BuiltInEvalHandler} its built-in declares, which may resolve further nodes recursively.
 * Helper of {@link Resolve.toValue}; use that instead to resolve the value of an identifier or node.
 */
export function resolveNode(args: BuiltInEvalHandlerArgs): Value {
	const { node, environment, ctx } = args;
	const nt = node.type;
	if(nt === RType.String) {
		return RValue.ofStringLiteral(node.content) ?? Top;
	} else if(nt === RType.Number) {
		return valueFromRNumber(node.content);
	} else if(nt === RType.Logical) {
		return node.content.valueOf() ? ValueLogicalTrue : ValueLogicalFalse;
	} else if(nt === RType.FunctionDefinition) {
		return { type: 'function-definition' };
	}
	const name = evalNameOf(args);
	const handler = name === undefined ? undefined : evalHandlerOf(name, environment, ctx);
	return handler?.(args) ?? Top;
}

/** Resolves a vector call `c` to a {@link ValueVector}; helper of {@link resolveNode|resolveNode}. */
export function resolveAsVector(args: BuiltInEvalHandlerArgs): ValueVector | typeof Top {
	const node = args.node;
	if(!RFunctionCall.is(node)) {
		return Top;
	}
	return vectorFrom(flattenVectorElements(node.arguments.map(arg => arg !== EmptyArgument ? Resolve.toValue(arg.value, args) : Top)));
}

/** Resolves the sequence operator `:` to a {@link ValueVector} of {@link ValueNumber}s; helper of {@link resolveNode}. */
export function resolveAsSeq(args: BuiltInEvalHandlerArgs): ValueVector<Lift<ValueNumber[]>> | typeof Top {
	const operator = args.node;
	if(!RBinaryOp.is(operator)) {
		return Top;
	}
	const leftValue = unliftRValue(Resolve.toValue(operator.lhs, args));
	const rightValue = unliftRValue(Resolve.toValue(operator.rhs, args));

	if(isRNumberValue(leftValue) && isRNumberValue(rightValue)) {
		const sequence = createNumberSequence(leftValue, rightValue);
		return sequence === undefined ? Top : vectorFrom(sequence.map(liftScalar));
	}
	return Top;
}

/**
 * How many elements of a sequence are worth naming one by one. `1:148066` is a loop bound rather than a set of
 * indices anything asks about, and holding one object per element costs more than the precision is worth, so
 * a longer sequence resolves to {@link Top} instead.
 */
const MaxSequenceLength = 4096;

/**
 * The elements `from:to` runs over, counting down whenever `to` is the smaller one, and stopping before it
 * would pass `to` (`1:3.5` ends at `3`). `undefined` for a bound that names no position to count from or to,
 * and for a sequence longer than {@link MaxSequenceLength}.
 */
function createNumberSequence(start: RNumberValue, end: RNumberValue): RNumberValue[] | undefined {
	if(!Number.isFinite(start.num) || !Number.isFinite(end.num)) {
		return undefined;
	} else if(Math.floor(Math.abs(end.num - start.num)) + 1 > MaxSequenceLength) {
		return undefined;
	}
	const step = start.num <= end.num ? 1 : -1;
	const sequence: RNumberValue[] = [];
	for(let i = start.num; step > 0 ? i <= end.num : i >= end.num; i += step) {
		sequence.push({ ...start, num: i });
	}
	return sequence;
}
