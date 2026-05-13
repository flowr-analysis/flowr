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
 *
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
 *
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
 *
 */
export function unaryIdentityConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(_argNodeId: NodeId, state: StateDomain): StateDomain {
	return state;
}

/**
 *
 */
export function binaryIdentityConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(_leftNodeId: NodeId, _rightNodeId: NodeId, state: StateDomain): StateDomain {
	return state;
}

/**
 *
 */
export function createConditionApplier<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends AbstractInterpretationVisitor<StateDomain>>(
	domainSpecificMapper: ConditionSemanticsMapperInfo<StateDomain, Visitor>[],
	onUnknownPositiveFunctionCall?: UnaryConditionSemantics<StateDomain, Visitor>,
	onUnknownNegativeFunctionCall?: UnaryConditionSemantics<StateDomain, Visitor>,
): { applyConditionSemantics: UnaryConditionSemantics<StateDomain, Visitor>, applyNegatedConditionSemantics: UnaryConditionSemantics<StateDomain, Visitor> } {
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