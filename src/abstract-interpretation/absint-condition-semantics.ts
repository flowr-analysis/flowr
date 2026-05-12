import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { FunctionArgument } from '../dataflow/graph/graph';
import { Identifier } from '../dataflow/environments/identifier';
import { isNotUndefined, isUndefined } from '../util/assert';
import { numericInferenceLogger } from './interval/numeric-interval-inference';
import { isFunctionCallVertex } from '../dataflow/graph/vertex';
import type { AnyStateDomain } from './domains/state-domain-like';
import type { AnyAbstractDomain } from './domains/abstract-domain';

export type SetValue<ValueDomain extends AnyAbstractDomain | undefined, StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (state: StateDomain) => (node: NodeId, value: ValueDomain) => void;
export type GetValue<ValueDomain extends AnyAbstractDomain | undefined, StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (node: NodeId, state?: StateDomain) => ValueDomain | undefined;
export type GetVariableOrigins = (node: NodeId) => NodeId[];

export type NAryConditionSemantics<ValueDomain extends AnyAbstractDomain | undefined, StateDomain extends AnyStateDomain<AnyAbstractDomain>> =
	(
		argNodeIds: readonly (NodeId | undefined)[],
		state: StateDomain,
		setValue: SetValue<ValueDomain, StateDomain>,
		getValue: GetValue<ValueDomain, StateDomain>,
		getVariableOrigins: GetVariableOrigins,
		dfg: DataflowGraph
	) => StateDomain;

export type UnaryConditionSemantics<ValueDomain extends AnyAbstractDomain | undefined, StateDomain extends AnyStateDomain<AnyAbstractDomain>> =
	(
		argNodeId: NodeId,
		state: StateDomain,
		setValue: SetValue<ValueDomain, StateDomain>,
		getValue: GetValue<ValueDomain, StateDomain>,
		getVariableOrigins: GetVariableOrigins,
		dfg: DataflowGraph
	) => StateDomain;

export type BinaryConditionSemantics<ValueDomain extends AnyAbstractDomain | undefined, StateDomain extends AnyStateDomain<AnyAbstractDomain>> =
	(
		leftNodeId: NodeId,
		rightNodeId: NodeId,
		state: StateDomain,
		setValue: SetValue<ValueDomain, StateDomain>,
		getValue: GetValue<ValueDomain, StateDomain>,
		getVariableOrigins: GetVariableOrigins,
		dfg: DataflowGraph
	) => StateDomain;

export type ConditionSemanticsMapperInfo<ValueDomain extends AnyAbstractDomain | undefined, StateDomain extends AnyStateDomain<AnyAbstractDomain>> =
	[identifier: Identifier, semantics: NAryConditionSemantics<ValueDomain, StateDomain>, negatedSemantics: NAryConditionSemantics<ValueDomain, StateDomain>];

/**
 *
 */
export function unaryConditionSemanticsGuard<ValueDomain extends AnyAbstractDomain | undefined, StateDomain extends AnyStateDomain<AnyAbstractDomain>>(
	unaryConditionSemantics: UnaryConditionSemantics<ValueDomain, StateDomain>
): NAryConditionSemantics<ValueDomain, StateDomain> {
	return (argNodeIds: readonly (NodeId | undefined)[], state: StateDomain, setValue: SetValue<ValueDomain, StateDomain>, getValue: GetValue<ValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 1 || isUndefined(argNodeIds[0])) {
			numericInferenceLogger.warn('Called unary condition operator with more/less than 1 argument or with undefined argument.');
			return state;
		}
		return unaryConditionSemantics(argNodeIds[0], state, setValue, getValue, getVariableOrigins, dfg);
	};
}

/**
 *
 */
export function binaryConditionSemanticsGuard<ValueDomain extends AnyAbstractDomain | undefined, StateDomain extends AnyStateDomain<AnyAbstractDomain>>(
	binaryConditionSemantics: BinaryConditionSemantics<ValueDomain, StateDomain>
): NAryConditionSemantics<ValueDomain, StateDomain> {
	return (argNodeIds: readonly (NodeId | undefined)[], state: StateDomain, setValue: SetValue<ValueDomain, StateDomain>, getValue: GetValue<ValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 2 || isUndefined(argNodeIds[0]) || isUndefined(argNodeIds[1])) {
			numericInferenceLogger.warn('Called binary condition operator with more/less than 2 arguments or with undefined arguments.');
			return state;
		}
		return binaryConditionSemantics(argNodeIds[0], argNodeIds[1], state, setValue, getValue, getVariableOrigins, dfg);
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
export function createConditionApplier<ValueDomain extends AnyAbstractDomain | undefined, StateDomain extends AnyStateDomain<AnyAbstractDomain>>(
	domainSpecificMapper: ConditionSemanticsMapperInfo<ValueDomain, StateDomain>[],
	onUnknownPositiveFunctionCall?: UnaryConditionSemantics<ValueDomain, StateDomain>,
	onUnknownNegativeFunctionCall?: UnaryConditionSemantics<ValueDomain, StateDomain>,
): { applyConditionSemantics: UnaryConditionSemantics<ValueDomain, StateDomain>, applyNegatedConditionSemantics: UnaryConditionSemantics<ValueDomain, StateDomain> } {
	const ConditionSemanticsMapper = [
		...domainSpecificMapper,
		[Identifier.make('!'), unaryConditionSemanticsGuard(applyNegatedConditionSemantics), unaryConditionSemanticsGuard(applyConditionSemantics)],
		[Identifier.make('('), unaryConditionSemanticsGuard(applyConditionSemantics), unaryConditionSemanticsGuard(applyNegatedConditionSemantics)],
		[Identifier.make('||'), binaryConditionSemanticsGuard(orConditionSemantics), binaryConditionSemanticsGuard(negatedOrConditionSemantics)],
		[Identifier.make('&&'), binaryConditionSemanticsGuard(andConditionSemantics), binaryConditionSemanticsGuard(negatedAndConditionSemantics)],
	] as const satisfies ConditionSemanticsMapperInfo<ValueDomain, StateDomain>[];

	function orConditionSemantics(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, setValue: SetValue<ValueDomain, StateDomain>, getValue: GetValue<ValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
		const leftState = applyConditionSemantics(leftNodeId, state.create(state.value), setValue, getValue, getVariableOrigins, dfg);
		const rightState = applyConditionSemantics(rightNodeId, state.create(state.value), setValue, getValue, getVariableOrigins, dfg);

		return leftState.join(rightState);
	}

	function andConditionSemantics(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, setValue: SetValue<ValueDomain, StateDomain>, getValue: GetValue<ValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
		const leftState = applyConditionSemantics(leftNodeId, state.create(state.value), setValue, getValue, getVariableOrigins, dfg);
		const rightState = applyConditionSemantics(rightNodeId, state.create(state.value), setValue, getValue, getVariableOrigins, dfg);

		return leftState.meet(rightState);
	}

	function negatedOrConditionSemantics(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, setValue: SetValue<ValueDomain, StateDomain>, getValue: GetValue<ValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
		const leftState = applyNegatedConditionSemantics(leftNodeId, state.create(state.value), setValue, getValue, getVariableOrigins, dfg);
		const rightState = applyNegatedConditionSemantics(rightNodeId, state.create(state.value), setValue, getValue, getVariableOrigins, dfg);

		return leftState.meet(rightState);
	}

	function negatedAndConditionSemantics(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, setValue: SetValue<ValueDomain, StateDomain>, getValue: GetValue<ValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
		const leftState = applyNegatedConditionSemantics(leftNodeId, state.create(state.value), setValue, getValue, getVariableOrigins, dfg);
		const rightState = applyNegatedConditionSemantics(rightNodeId, state.create(state.value), setValue, getValue, getVariableOrigins, dfg);

		return leftState.join(rightState);
	}

	function applyConditionSemantics(argNodeId: NodeId | undefined, state: StateDomain, setValue: SetValue<ValueDomain, StateDomain>, getValue: GetValue<ValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
		if(isUndefined(argNodeId)) {
			return state;
		}

		const vertex = dfg.getVertex(argNodeId);
		if(isFunctionCallVertex(vertex)) {
			const match = ConditionSemanticsMapper.find(([id]) => Identifier.matches(id, vertex.name));

			if(isNotUndefined(match)) {
				const [_, semantics] = match;
				return semantics(vertex.args.map(FunctionArgument.getReference), state, setValue, getValue, getVariableOrigins, dfg);
			}
		}

		return onUnknownPositiveFunctionCall ? onUnknownPositiveFunctionCall(argNodeId, state, setValue, getValue, getVariableOrigins, dfg) : state;
	}

	function applyNegatedConditionSemantics(argNodeId: NodeId | undefined, state: StateDomain, setValue: SetValue<ValueDomain, StateDomain>, getValue: GetValue<ValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
		if(isUndefined(argNodeId)) {
			return state;
		}

		const vertex = dfg.getVertex(argNodeId);
		if(isFunctionCallVertex(vertex)) {
			const match = ConditionSemanticsMapper.find(([id]) => Identifier.matches(id, vertex.name));

			if(isNotUndefined(match)) {
				const [, , negatedSemantics] = match;
				return negatedSemantics(vertex.args.map(FunctionArgument.getReference), state, setValue, getValue, getVariableOrigins, dfg);
			}
		}

		return onUnknownNegativeFunctionCall ? onUnknownNegativeFunctionCall(argNodeId, state, setValue, getValue, getVariableOrigins, dfg) : state;
	}

	return { applyConditionSemantics, applyNegatedConditionSemantics };
}