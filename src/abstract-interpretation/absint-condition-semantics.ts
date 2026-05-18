import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { FunctionArgument } from '../dataflow/graph/graph';
import { Identifier } from '../dataflow/environments/identifier';
import { isNotUndefined, isUndefined } from '../util/assert';
import { numericInferenceLogger } from './interval/numeric-interval-inference';
import { isFunctionCallVertex } from '../dataflow/graph/vertex';
import type { AnyStateDomain } from './domains/state-domain-like';
import type { AnyAbstractDomain } from './domains/abstract-domain';
import type { AbstractInterpretationVisitor } from './absint-visitor';

export type NAryConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends AbstractInterpretationVisitor<StateDomain>> =
	(
		argNodeIds: readonly (NodeId | undefined)[],
		state: StateDomain,
		visitor: Visitor,
		dfg: DataflowGraph
	) => StateDomain;

export type UnaryConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends AbstractInterpretationVisitor<StateDomain>> =
	(
		argNodeId: NodeId,
		state: StateDomain,
		visitor: Visitor,
		dfg: DataflowGraph
	) => StateDomain;

export type BinaryConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends AbstractInterpretationVisitor<StateDomain>> =
	(
		leftNodeId: NodeId,
		rightNodeId: NodeId,
		state: StateDomain,
		visitor: Visitor,
		dfg: DataflowGraph
	) => StateDomain;

export type ConditionSemanticsMapperInfo<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends AbstractInterpretationVisitor<StateDomain>> =
	[identifier: Identifier, semantics: NAryConditionSemantics<StateDomain, Visitor>, negatedSemantics: NAryConditionSemantics<StateDomain, Visitor>];

/**
 * Returns a callback, that extracts exactly one argument and calls the provided unary condition semantics function.
 * If more or less than one argument is provided, no semantics are applied and a warning is logged.
 * @param unaryConditionSemantics - The condition semantics to call.
 */
export function unaryConditionSemanticsGuard<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends AbstractInterpretationVisitor<StateDomain>>(
	unaryConditionSemantics: UnaryConditionSemantics<StateDomain, Visitor>
): NAryConditionSemantics<StateDomain, Visitor> {
	return (argNodeIds: readonly (NodeId | undefined)[], state: StateDomain, visitor: Visitor, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 1 || isUndefined(argNodeIds[0])) {
			numericInferenceLogger.warn('Called unary condition operator with more/less than 1 argument or with undefined argument.');
			return state;
		}
		return unaryConditionSemantics(argNodeIds[0], state, visitor, dfg);
	};
}

/**
 * Returns a callback, that extracts exactly two arguments and calls the provided unary condition semantics function.
 * If more or less than two arguments are provided, no semantics are applies and a warning is logged.
 * @param binaryConditionSemantics - The condition semantics to call.
 */
export function binaryConditionSemanticsGuard<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends AbstractInterpretationVisitor<StateDomain>>(
	binaryConditionSemantics: BinaryConditionSemantics<StateDomain, Visitor>
): NAryConditionSemantics<StateDomain, Visitor> {
	return (argNodeIds: readonly (NodeId | undefined)[], state: StateDomain, visitor: Visitor, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 2 || isUndefined(argNodeIds[0]) || isUndefined(argNodeIds[1])) {
			numericInferenceLogger.warn('Called binary condition operator with more/less than 2 arguments or with undefined arguments.');
			return state;
		}
		return binaryConditionSemantics(argNodeIds[0], argNodeIds[1], state, visitor, dfg);
	};
}

/**
 * Returns the unmodified state.
 */
export function unaryIdentityConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(_argNodeId: NodeId, state: StateDomain): StateDomain {
	return state;
}

/**
 * Returns the unmodified state.
 */
export function binaryIdentityConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(_leftNodeId: NodeId, _rightNodeId: NodeId, state: StateDomain): StateDomain {
	return state;
}

export type ConditionAppliers<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends AbstractInterpretationVisitor<StateDomain>> = { applyConditionSemantics: UnaryConditionSemantics<StateDomain, Visitor>, applyNegatedConditionSemantics: UnaryConditionSemantics<StateDomain, Visitor> };

/**
 * Creates and returns the applyConditionSemantics and applyNegatedConditionSemantics functions for a given state domain and visitor.
 * The returned functions should be called by the {@link AbstractInterpretationVisitor.applyConditionSemantics} function of the state domain specific visitor.
 * Default semantics for "!", "(", "&&", and "||" are already provided, but can be overridden by providing custom semantics.
 * @param domainSpecificMapper - List of custom semantics. For each identifier, the semantics and its negated semantics have to be provided.
 * @param onUnknownPositiveFunctionCall - This function is called by applyConditionSemantics if a function call vertex is encountered for which no semantics are provided, or the vertex is no function call (e.g. an expression).
 * @param onUnknownNegativeFunctionCall - This function is called by applyNegatedConditionSemantics if a function call vertex is encountered for which no semantics are provided, or the vertex is no function call (e.g. an expression).
 */
export function createConditionApplier<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends AbstractInterpretationVisitor<StateDomain>>(
	domainSpecificMapper: readonly ConditionSemanticsMapperInfo<StateDomain, Visitor>[],
	onUnknownPositiveFunctionCall?: UnaryConditionSemantics<StateDomain, Visitor>,
	onUnknownNegativeFunctionCall?: UnaryConditionSemantics<StateDomain, Visitor>,
): ConditionAppliers<StateDomain, Visitor> {
	const ConditionSemanticsMapper = [
		...domainSpecificMapper,
		[Identifier.make('!'), unaryConditionSemanticsGuard(applyNegatedConditionSemantics), unaryConditionSemanticsGuard(applyConditionSemantics)],
		[Identifier.make('('), unaryConditionSemanticsGuard(applyConditionSemantics), unaryConditionSemanticsGuard(applyNegatedConditionSemantics)],
		[Identifier.make('||'), binaryConditionSemanticsGuard(orConditionSemantics), binaryConditionSemanticsGuard(negatedOrConditionSemantics)],
		[Identifier.make('&&'), binaryConditionSemanticsGuard(andConditionSemantics), binaryConditionSemanticsGuard(negatedAndConditionSemantics)],
	] as const satisfies ConditionSemanticsMapperInfo<StateDomain, Visitor>[];

	function orConditionSemantics(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor, dfg: DataflowGraph): StateDomain {
		const leftState = applyConditionSemantics(leftNodeId, state.create(state.value), visitor, dfg);
		const rightState = applyConditionSemantics(rightNodeId, state.create(state.value), visitor, dfg);

		return leftState.join(rightState);
	}

	function andConditionSemantics(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor, dfg: DataflowGraph): StateDomain {
		const leftState = applyConditionSemantics(leftNodeId, state.create(state.value), visitor, dfg);
		const rightState = applyConditionSemantics(rightNodeId, state.create(state.value), visitor, dfg);

		return leftState.meet(rightState);
	}

	function negatedOrConditionSemantics(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor, dfg: DataflowGraph): StateDomain {
		const leftState = applyNegatedConditionSemantics(leftNodeId, state.create(state.value), visitor, dfg);
		const rightState = applyNegatedConditionSemantics(rightNodeId, state.create(state.value), visitor, dfg);

		return leftState.meet(rightState);
	}

	function negatedAndConditionSemantics(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor, dfg: DataflowGraph): StateDomain {
		const leftState = applyNegatedConditionSemantics(leftNodeId, state.create(state.value), visitor, dfg);
		const rightState = applyNegatedConditionSemantics(rightNodeId, state.create(state.value), visitor, dfg);

		return leftState.join(rightState);
	}

	function applyConditionSemantics(argNodeId: NodeId | undefined, state: StateDomain, visitor: Visitor, dfg: DataflowGraph): StateDomain {
		if(isUndefined(argNodeId)) {
			return state;
		}

		const vertex = dfg.getVertex(argNodeId);
		if(isFunctionCallVertex(vertex)) {
			const match = ConditionSemanticsMapper.find(([id]) => Identifier.matches(id, vertex.name));

			if(isNotUndefined(match)) {
				const [_, semantics] = match;
				return semantics(vertex.args.map(FunctionArgument.getReference), state, visitor, dfg);
			}
		}

		return onUnknownPositiveFunctionCall ? onUnknownPositiveFunctionCall(argNodeId, state, visitor, dfg) : state;
	}

	function applyNegatedConditionSemantics(argNodeId: NodeId | undefined, state: StateDomain, visitor: Visitor, dfg: DataflowGraph): StateDomain {
		if(isUndefined(argNodeId)) {
			return state;
		}

		const vertex = dfg.getVertex(argNodeId);
		if(isFunctionCallVertex(vertex)) {
			const match = ConditionSemanticsMapper.find(([id]) => Identifier.matches(id, vertex.name));

			if(isNotUndefined(match)) {
				const [, , negatedSemantics] = match;
				return negatedSemantics(vertex.args.map(FunctionArgument.getReference), state, visitor, dfg);
			}
		}

		return onUnknownNegativeFunctionCall ? onUnknownNegativeFunctionCall(argNodeId, state, visitor, dfg) : state;
	}

	return { applyConditionSemantics, applyNegatedConditionSemantics };
}