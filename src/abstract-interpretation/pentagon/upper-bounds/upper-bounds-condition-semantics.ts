import type { AnyStateDomain } from '../../domains/state-domain-like';
import type { AnyAbstractDomain } from '../../domains/abstract-domain';
import { AbstractDomain } from '../../domains/abstract-domain';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { UpperBoundsValueDomain } from './upper-bounds-value-domain';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { FunctionArgument } from '../../../dataflow/graph/graph';
import { isNotUndefined, isUndefined } from '../../../util/assert';
import { isFunctionCallVertex } from '../../../dataflow/graph/vertex';
import { numericInferenceLogger } from '../../interval/numeric-interval-inference';

function getSemanticsMapper<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(): UpperBoundsConditionSemanticsMapperInfo<StateDomain>[] {
	return [
		[Identifier.make('!'), unaryCondOpSemantics(applyNegatedUpperBoundsConditionSemantics), unaryCondOpSemantics(applyUpperBoundsConditionSemantics)],
		[Identifier.make('('), unaryCondOpSemantics(applyUpperBoundsConditionSemantics), unaryCondOpSemantics(applyNegatedUpperBoundsConditionSemantics)],
		[Identifier.make('=='), binaryCondOpSemantics(upperBoundsEqualsOp), binaryCondOpSemantics(upperBoundsNotEqualsOp)],
		[Identifier.make('!='), binaryCondOpSemantics(upperBoundsNotEqualsOp), binaryCondOpSemantics(upperBoundsEqualsOp)],
		[Identifier.make('>'), binaryCondOpSemantics(upperBoundsGreaterOp), binaryCondOpSemantics(upperBoundsLessEqualOp)],
		[Identifier.make('>='), binaryCondOpSemantics(upperBoundsGreaterEqualOp), binaryCondOpSemantics(upperBoundsLessOp)],
		[Identifier.make('<'), binaryCondOpSemantics(upperBoundsLessOp), binaryCondOpSemantics(upperBoundsGreaterEqualOp)],
		[Identifier.make('<='), binaryCondOpSemantics(upperBoundsLessEqualOp), binaryCondOpSemantics(upperBoundsGreaterOp)],
		[Identifier.make('is.na'), unaryCondOpSemantics(upperBoundsUnaryIdentity), unaryCondOpSemantics(upperBoundsUnaryIdentity)],
	] as const satisfies UpperBoundsConditionSemanticsMapperInfo<StateDomain>[];
}

type UpperBoundsConditionSemanticsMapperInfo<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = [identifier: Identifier, semantics: UbNAryFnSemantics<StateDomain>, negatedSemantics: UbNAryFnSemantics<StateDomain>];

export type SetUbState<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (state: StateDomain) => (node: NodeId, upperBounds: UpperBoundsValueDomain) => void;
export type GetUb<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (nodeId: NodeId, state?: StateDomain) => UpperBoundsValueDomain | undefined;
type GetVariableOrigins = (node: NodeId) => NodeId[];

/**
 * Upper-bounds condition semantics definition for n-ary functions, where the semantics can be applied to any number of arguments.
 * @param argNodeIds - The node ids of the arguments of the function.
 * @param state - The state to retrieve the argument values and apply the semantics to.
 * @param set - Setter function to update an upper-bound in the provided state.
 * @param getUb - Retrieves the inferred abstract upper-bound from the visitor for the provided node.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
type UbNAryFnSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (argNodeIds: readonly (NodeId | undefined)[], state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => StateDomain;

/**
 * Upper-bounds condition semantics definition for unary operators.
 * @param argNodeId - The node id of the argument of the unary operator.
 * @param state - The state to retrieve the argument values and apply the semantics to.
 * @param set - Setter function to update an upper-bound in the provided state.
 * @param getUb - Retrieves the inferred abstract upper-bound from the visitor for the provided node.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
type UbUnaryOperatorSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (argNodeId: NodeId, state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => StateDomain;

/**
 * Upper-bounds condition semantics definition for binary operators.
 * @param leftNodeId - The node id of the left argument of the binary operator.
 * @param rightNodeId - The node id of the right argument of the binary operator.
 * @param state - The state to retrieve the argument values and apply the semantics to.
 * @param set - Setter function to update an upper-bound in the provided state.
 * @param getUb - Retrieves the inferred abstract upper-bound from the visitor for the provided node.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
type UbBinaryOperatorSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => StateDomain;

/**
 * Applies the abstract condition semantics of the provided function with respect to the upper-bounds domain to the provided args.
 * @param argNodeId - The node id representing the condition to which the semantics should be applied.
 * @param state - The state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param set - Setter function to update an upper-bound in the provided state.
 * @param getUb - Retrieves the inferred abstract upper-bound from the visitor for the provided node.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
export function applyUpperBoundsConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(argNodeId: NodeId | undefined, state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
	if(isUndefined(argNodeId)) {
		return state;
	}

	const vertex = dfg.getVertex(argNodeId);
	if(isFunctionCallVertex(vertex)) {
		const match = getSemanticsMapper<StateDomain>().find(([id]) => Identifier.matches(id, vertex.name));

		if(isNotUndefined(match)) {
			const [_, semantics] = match;
			return semantics(vertex.args.map(FunctionArgument.getReference), state, set, getUb, getVariableOrigins, dfg);
		}
	}

	return state;
}

/**
 * Applies the negated abstract condition semantics of the provided function with respect to the upper-bounds domain to the provided args.
 * @param argNodeId - The node id representing the condition to which the semantics should be applied.
 * @param state - The state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param set - Setter function to update an upper-bound in the provided state.
 * @param getUb - Retrieves the inferred abstract upper-bound from the visitor for the provided node.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the negated semantics.
 */
export function applyNegatedUpperBoundsConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(argNodeId: NodeId | undefined, state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
	if(isUndefined(argNodeId)) {
		return state;
	}

	const vertex = dfg.getVertex(argNodeId);
	if(isFunctionCallVertex(vertex)) {
		const match = getSemanticsMapper<StateDomain>().find(([id]) => Identifier.matches(id, vertex.name));

		if(isNotUndefined(match)) {
			const [, , negatedSemantics] = match;
			return negatedSemantics(vertex.args.map(FunctionArgument.getReference), state, set, getUb, getVariableOrigins, dfg);
		}
	}

	return state;
}

/**
 * Guard for unary operators, filtering all calls with more/less than 1 argument or with undefined argument.
 * If the call has exactly 1 defined argument, the provided unary operator semantics is applied to it.
 * Otherwise, the state is returned unmodified and a warning is logged.
 * @param unaryOperatorSemantics - The semantics to apply if the call has exactly 1 defined argument.
 * @returns The semantics to apply for a unary operator call, which includes the guard for the number of arguments.
 */
function unaryCondOpSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(unaryOperatorSemantics: UbUnaryOperatorSemantics<StateDomain>): UbNAryFnSemantics<StateDomain> {
	return (argNodeIds: readonly (NodeId | undefined)[], state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 1 || isUndefined(argNodeIds[0])) {
			numericInferenceLogger.warn('Called unary condition operator with more/less than 1 argument or with undefined argument.');
			return state;
		}
		return unaryOperatorSemantics(argNodeIds[0], state, set, getUb, getVariableOrigins, dfg);
	};
}

/**
 * Guard for binary operators, filtering all calls with more/less than 2 arguments or with undefined arguments.
 * If the call has exactly 2 defined arguments, the provided binary operator semantics is applied to them.
 * Otherwise, the state is returned unmodified and a warning is logged.
 * @param binaryOperatorSemantics - The semantics to apply if the call has exactly 2 defined arguments.
 * @returns The semantics to apply for a binary operator call, which includes the guard for the number of arguments.
 */
function binaryCondOpSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(binaryOperatorSemantics: UbBinaryOperatorSemantics<StateDomain>): UbNAryFnSemantics<StateDomain> {
	return (argNodeIds: readonly (NodeId | undefined)[], state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 2 || isUndefined(argNodeIds[0]) || isUndefined(argNodeIds[1])) {
			numericInferenceLogger.warn('Called binary condition operator with more/less than 2 arguments or with undefined arguments.');
			return state;
		}

		return binaryOperatorSemantics(argNodeIds[0], argNodeIds[1], state, set, getUb, getVariableOrigins, dfg);
	};
}

function upperBoundsEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	const leftValue = getUb(leftNodeId, state);
	const rightValue = getUb(rightNodeId, state);

	// We need to include the origin ids instead of the reference ids if the variable has an origin.
	// We can only include the origin if there is only one origin, as we only then know that this is the only possible origin.
	const originNodeIds = new Set<NodeId>();

	const leftOrigins = getVariableOrigins(leftNodeId);
	const leftOrigin = leftOrigins.length === 1 ? leftOrigins[0] : leftNodeId;
	const rightOrigins = getVariableOrigins(rightNodeId);
	const rightOrigin = rightOrigins.length === 1 ? rightOrigins[0] : rightNodeId;
	if(leftOrigins.length <= 1) {
		originNodeIds.add(leftOrigin);
	}
	if(rightOrigins.length <= 1) {
		originNodeIds.add(rightOrigin);
	}

	const resultingUpperBounds = AbstractDomain.meetAll([leftValue, rightValue, new UpperBoundsValueDomain(originNodeIds)].filter(isNotUndefined));

	if(resultingUpperBounds.isBottom()) {
		return state.bottom();
	}

	if(leftOrigins.length <= 1) {
		set(state)(leftOrigin, resultingUpperBounds);
	}
	if(rightOrigins.length <= 1) {
		set(state)(rightOrigin, resultingUpperBounds);
	}

	return state;
}

function upperBoundsNotEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, _set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	const leftValue = getUb(leftNodeId, state);
	const rightValue = getUb(rightNodeId, state);

	if(isUndefined(leftValue) || isUndefined(rightValue)) {
		return state;
	}
	if(leftValue.isBottom() || rightValue.isBottom()) {
		return state.bottom();
	}

	// We can only argue if both sides have exactly one origin (or are the origin).
	// In that case, if both sides include each others origins, they must be equal and therefore cannot be inequal.
	const leftOrigins = getVariableOrigins(leftNodeId);
	const leftOrigin = leftOrigins.length === 1 ? leftOrigins[0] : leftNodeId;
	const rightOrigins = getVariableOrigins(rightNodeId);
	const rightOrigin = rightOrigins.length === 1 ? rightOrigins[0] : rightNodeId;
	if(leftOrigins.length <= 1 && rightOrigins.length <= 1 && leftValue.has(rightOrigin) && rightValue.has(leftOrigin)) {
		return state.bottom();
	}

	return state;
}

function upperBoundsGreaterEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	const leftValue = getUb(leftNodeId, state);
	const rightValue = getUb(rightNodeId, state);

	const leftOrigins = getVariableOrigins(leftNodeId);
	const leftOrigin = leftOrigins.length === 1 ? leftOrigins[0] : leftNodeId;
	const rightOrigins = getVariableOrigins(rightNodeId);
	const rightOrigin = rightOrigins.length === 1 ? rightOrigins[0] : rightNodeId;

	// We want to upper bounds of the right side, which we can only do if there is exactly on origin that we can update.
	if(rightOrigins.length > 1) {
		return state;
	}

	// We can only include the left side as upper bounds, if the left side has exactly one origin that we can include.
	const resultingUpperBounds = AbstractDomain.meetAll([leftValue, rightValue, new UpperBoundsValueDomain(new Set(leftOrigins.length <= 1 ? [leftOrigin] : []))].filter(isNotUndefined));

	// Update the upper-bounds of the right side
	if(resultingUpperBounds.isBottom()) {
		return state.bottom();
	}

	set(state)(rightOrigin, resultingUpperBounds);

	return state;
}

function upperBoundsGreaterOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	return upperBoundsGreaterEqualOp(leftNodeId, rightNodeId, state, set, getUb, getVariableOrigins);
}

function upperBoundsLessEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	return upperBoundsGreaterEqualOp(rightNodeId, leftNodeId, state, set, getUb, getVariableOrigins);
}

function upperBoundsLessOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetUbState<StateDomain>, getUb: GetUb<StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	return upperBoundsGreaterOp(rightNodeId, leftNodeId, state, set, getUb, getVariableOrigins);
}

function upperBoundsUnaryIdentity<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(_argNodeId: NodeId, state: StateDomain): StateDomain {
	return state;
}








