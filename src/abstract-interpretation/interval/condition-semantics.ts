import { Identifier } from '../../dataflow/environments/identifier';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { NumericInferenceVisitor } from './numeric-inference';
import type { IntervalDomain } from '../domains/interval-domain';
import { MutableStateAbstractDomain } from '../domains/state-abstract-domain';
import type { DataflowGraphVertexInfo } from '../../dataflow/graph/vertex';
import { isFunctionCallVertex } from '../../dataflow/graph/vertex';
import { isNotUndefined } from '../../util/assert';

/**
 * Applies the abstract condition semantics of the provided function with respect to the interval domain to the provided args.
 * @param vertex - The vertex representing the condition to which the semantics should be applied.
 * @param currentState - The current state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
export function applyIntervalConditionSemantics(vertex: DataflowGraphVertexInfo | undefined, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph): MutableStateAbstractDomain<IntervalDomain> | undefined {
	if(isFunctionCallVertex(vertex)) {
		if(Identifier.matches(Identifier.make('!'), vertex.name)) {
			if(vertex.args.length !== 1 || FunctionArgument.isEmpty(vertex.args[0])) {
				return currentState;
			}

			const arg = vertex.args[0];
			const argVertex = dfg.getVertex(arg.nodeId);
			return applyNegation(argVertex, currentState, visitor, dfg);
		} else if(Identifier.matches(Identifier.make('('), vertex.name)) {
			if(vertex.args.length !== 1 || FunctionArgument.isEmpty(vertex.args[0])) {
				return currentState;
			}

			const arg = vertex.args[0];
			const argVertex = dfg.getVertex(arg.nodeId);
			return applyIntervalConditionSemantics(argVertex, currentState, visitor, dfg);
		}
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.
	// As the handling for top (indicating either expression returning top or absence of expression) is the same for evaluating an expression and evaluating a condition, we can just apply the semantics for evaluating an expression in this case.

	const argState = visitor.getAbstractValue(vertex?.id);

	if(argState?.isValue() && argState.value[0] == 0 && argState.value[1] == 0) {
		// Map every variable in state to bottom (fix until state-domain rework)
		if(isNotUndefined(currentState)) {
			// for(const entry of currentState.value.entries()) {
			//  currentState.set(entry[0], entry[1].bottom());
			// }
			return currentState.bottom();
		}
		return new MutableStateAbstractDomain(new Map(), true);
	}

	return currentState;
}

/**
 * Applies the negated abstract condition semantics of the provided function with respect to the interval domain to the provided args.
 * @param vertex - The vertex representing the condition to which the negated semantics should be applied.
 * @param currentState - The current state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the negated semantics.
 */
export function applyNegatedIntervalConditionSemantics(vertex: DataflowGraphVertexInfo | undefined, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph): MutableStateAbstractDomain<IntervalDomain> | undefined {
	return applyNegation(vertex, currentState, visitor, dfg);
}


function applyNegation(arg: DataflowGraphVertexInfo | undefined, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph): MutableStateAbstractDomain<IntervalDomain> | undefined {
	if(isFunctionCallVertex(arg)) {
		const functionIdentifier = arg.name;
		if(Identifier.matches(Identifier.make('!'), functionIdentifier)) {
			if(arg.args.length !== 1 || FunctionArgument.isEmpty(arg.args[0])) {
				return currentState;
			}
			const innerArg = arg.args[0];
			const innerArgVertex = dfg.getVertex(innerArg.nodeId);
			return applyIntervalConditionSemantics(innerArgVertex, currentState, visitor, dfg);
		} else if(Identifier.matches(Identifier.make('('), functionIdentifier)) {
			if(arg.args.length !== 1 || FunctionArgument.isEmpty(arg.args[0])) {
				return currentState;
			}
			const innerArg = arg.args[0];
			const innerArgVertex = dfg.getVertex(innerArg.nodeId);
			return applyNegation(innerArgVertex, currentState, visitor, dfg);
		}
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.
	// As the handling for top (indicating either expression returning top or absence of expression) is the same for evaluating a negated expression and evaluating a negated condition, we can just apply the semantics for evaluating a negated expression in this case.

	const argState = visitor.getAbstractValue(arg?.id);

	if(argState?.isValue() && (0 < argState.value[0] || argState.value[1] < 0)) {
		// (fix until state-domain rework)
		if(isNotUndefined(currentState)) {
			// for(const entry of currentState.value.entries()) {
			//  currentState.set(entry[0], entry[1].bottom());
			// }
			return currentState.bottom();
		}
		return new MutableStateAbstractDomain(new Map(), true);
	}

	return currentState;
}