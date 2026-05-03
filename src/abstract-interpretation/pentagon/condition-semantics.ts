import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { GetInterval, SetIntervalState } from '../interval/condition-semantics';
import { applyIntervalConditionSemantics, applyNegatedIntervalConditionSemantics } from '../interval/condition-semantics';
import type { AnyStateDomain } from '../domains/state-domain-like';
import type { AnyAbstractDomain } from '../domains/abstract-domain';
import type { GetUb, SetUbState } from './upper-bounds/upper-bounds-condition-semantics';
import {
	applyNegatedUpperBoundsConditionSemantics,
	applyUpperBoundsConditionSemantics
} from './upper-bounds/upper-bounds-condition-semantics';

type GetVariableOrigins = (node: NodeId) => NodeId[];

/**
 * Applies the abstract condition semantics of the provided function with respect to the closed pentagon domain to the provided args.
 * Therefore, the condition semantics of the interval and upper-bounds domain are applied separately and then combined to obtain the filtered state.
 * @param argNodeId - The node id representing the condition to which the semantics should be applied.
 * @param state - The state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param setInterval - Setter function to update an interval in the provided state.
 * @param setUpperBounds - Setter function to update an upper bounds in the provided state.
 * @param getInterval - Retrieves the inferred abstract interval from the visitor for the provided node.
 * @param getUpperBounds - Retrieves the inferred abstract upper bounds from the visitor for the provided node.
 * @param reducePentagon - Is used to apply the pentagon reduction after applying the interval and upper bounds condition semantics.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
export function applyPentagonConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(argNodeId: NodeId | undefined, state: StateDomain, setInterval: SetIntervalState<StateDomain>, setUpperBounds: SetUbState<StateDomain>, getInterval: GetInterval<StateDomain>, getUpperBounds: GetUb<StateDomain>, reducePentagon: (state: StateDomain) => StateDomain, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
	return reducePentagon(
		applyUpperBoundsConditionSemantics(
			argNodeId,
			applyIntervalConditionSemantics(
				argNodeId,
				state,
				setInterval,
				getInterval,
				getVariableOrigins,
				dfg
			),
			setUpperBounds,
			getUpperBounds,
			getVariableOrigins,
			dfg
		)
	);
}

/**
 * Applies the negated abstract condition semantics of the provided function with respect to the closed pentagon domain to the provided args.
 * Therefore, the condition semantics of the interval and upper-bounds domain are applied separately and then combined to obtain the filtered state.
 * @param argNodeId - The node id representing the condition to which the semantics should be applied.
 * @param state - The state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param setInterval - Setter function to update an interval in the provided state.
 * @param setUpperBounds - Setter function to update an upper bounds in the provided state.
 * @param getInterval - Retrieves the inferred abstract interval from the visitor for the provided node.
 * @param getUpperBounds - Retrieves the inferred abstract upper bounds from the visitor for the provided node.
 * @param reducePentagon - Is used to apply the pentagon reduction after applying the interval and upper bounds condition semantics.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the negated semantics.
 */
export function applyNegatedPentagonConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(argNodeId: NodeId | undefined, state: StateDomain, setInterval: SetIntervalState<StateDomain>, setUpperBounds: SetUbState<StateDomain>, getInterval: GetInterval<StateDomain>, getUpperBounds: GetUb<StateDomain>, reducePentagon: (state: StateDomain) => StateDomain, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
	return reducePentagon(
		applyNegatedUpperBoundsConditionSemantics(
			argNodeId,
			applyNegatedIntervalConditionSemantics(
				argNodeId,
				state,
				setInterval,
				getInterval,
				getVariableOrigins,
				dfg
			),
			setUpperBounds,
			getUpperBounds,
			getVariableOrigins,
			dfg
		)
	);
}