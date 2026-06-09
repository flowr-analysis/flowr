import { ClosedPentagonDomain } from './closed-pentagon-domain';
import type { AbsintVisitorConfiguration } from '../absint-visitor';
import { AbstractInterpretationVisitor } from '../absint-visitor';
import { ClosedPentagonValueDomain } from './closed-pentagon-value-domain';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexValue } from '../../dataflow/graph/vertex';
import { isFunctionCallVertex, isValueVertex } from '../../dataflow/graph/vertex';
import type { RNumber } from '../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { IntervalDomain } from '../domains/interval-domain';
import type { IntervalInference } from '../interval/numeric-interval-inference';
import { UpperBoundsValueDomain } from './upper-bounds/upper-bounds-value-domain';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { applyPentagonExpressionSemantics } from './expression-semantics';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { getIntervalConditionSemantics } from '../interval/condition-semantics';
import { getUpperBoundsConditionSemantics } from './upper-bounds/upper-bounds-condition-semantics';
import type { AnyStateDomain } from '../domains/state-domain-like';
import type { AnyAbstractDomain } from '../domains/abstract-domain';
import { log } from '../../util/log';
import { FunctionArgument } from '../../dataflow/graph/graph';
import { Bottom } from '../domains/lattice';

const numericInferenceLogger = log.getSubLogger({ name: 'numeric-pentagon-inference' });

/**
 * Interface that needs to be implemented by any {@link AbstractInterpretationVisitor} that applies upper bounds
 * condition semantics.
 */
export interface UpperBoundsInference<StateDomain extends AnyStateDomain<AnyAbstractDomain>> {
	setUpperBounds(state: StateDomain, node: NodeId, value: UpperBoundsValueDomain): void;
	getUpperBounds(node: NodeId, state?: StateDomain): UpperBoundsValueDomain;

	/**
	 * This method is required when updating the upper bounds value as we can only add origin node ids as upper bounds.
	 * If we have multiple origins, we cannot say which one is the correct origin to add, so we cannot update the upper bounds.
	 * For this, this method returns the origin of the provided node in the dfg if there is exactly one origin
	 * (or the provided node already is the origin).
	 * If there are multiple origins, `undefined` is returned.
	 * @param node - Node to get the origin for.
	 */
	getOriginIfUnique(node: NodeId): NodeId | undefined;
}

export class NumericPentagonInferenceVisitor extends AbstractInterpretationVisitor<ClosedPentagonDomain> implements IntervalInference<ClosedPentagonDomain>, UpperBoundsInference<ClosedPentagonDomain> {
	constructor(config: AbsintVisitorConfiguration) {
		super(config, ClosedPentagonDomain.top(ClosedPentagonValueDomain.top()));
	}

	protected override onAssignmentCall({ call, target, source }: {
		call:    DataflowGraphVertexFunctionCall,
		target?: NodeId,
		source?: NodeId
	}): void {
		super.onAssignmentCall({ call, target, source });

		if(isNotUndefined(source) && isNotUndefined(target)) {
			const sourceOrigin = this.getOriginIfUnique(source);
			if(isUndefined(sourceOrigin)) {
				return;
			}

			const sourcePentagon = this.currentState.get(sourceOrigin);
			const targetPentagon = this.currentState.get(target);

			if(sourcePentagon?.isValue() && targetPentagon?.isValue()) {
				sourcePentagon.value.upperBounds.add(target);
				targetPentagon.value.upperBounds.add(sourceOrigin);
				// To every upper-bounds that contains source, also add target: a small reduction step to increase precision.
				if(this.currentState.isValue()) {
					for(const [_, closedPentagonValue] of this.currentState.value) {
						if(closedPentagonValue.value.upperBounds.has(sourceOrigin)) {
							closedPentagonValue.value.upperBounds.add(target);
						}
					}
				}
				this.currentState.set(sourceOrigin, sourcePentagon);
				this.currentState.set(target, targetPentagon);
			}

			// Remove information of all constants/expression results on the right hand side
			this.currentState = this.removeConstantAndExpressionInfo(source);
		}
	}

	/**
	 * Removes all inferred information for expressions and constants in the state, that are part of the provided nodeId.
	 * This is used for assignments, to remove any information on constants or expressions that are part of the source
	 * part of the assignment to reduce the number of inferred values for the following inference steps
	 * (as these information will not be referenced/required anymore, and will still be present in the traces of the
	 * respective node if queried).
	 * @param nodeId - The root node that contains the constant/expression infos to remove (should be source part of assignment).
	 * @param state - Optional state to modify, defaults to this.currentState.
	 * @private
	 */
	private removeConstantAndExpressionInfo(nodeId: NodeId, state?: ClosedPentagonDomain): ClosedPentagonDomain {
		state ??= this.currentState;
		const minifiedDomain = state.create(state.value);

		const removeConstant = (nodeId: NodeId, state: ClosedPentagonDomain): NodeId[] => {
			// Remove information of all constants on the right hand side
			const rhsVertex = this.config.dfg.getVertex(nodeId);
			if(isValueVertex(rhsVertex)) {
				state.remove(nodeId);
				return [nodeId];
			} else if(isFunctionCallVertex(rhsVertex)) {
				let removedNodeIds: NodeId[] = [];
				for(const arg of rhsVertex.args.map(FunctionArgument.getReference).filter(isNotUndefined)) {
					removedNodeIds = removedNodeIds.concat(removeConstant(arg, state));
				}
				state.remove(nodeId);
				removedNodeIds.push(nodeId);
				return removedNodeIds;
			}
			return [];
		};

		const removedNodeIds = new Set(removeConstant(nodeId, minifiedDomain));

		if(minifiedDomain.value !== Bottom && removedNodeIds.size > 0) {
			for(const [key, pentagon] of minifiedDomain.value.entries()) {
				if(pentagon.value.upperBounds.isValue()) {
					const upperBoundsToRemove = pentagon.value.upperBounds.value.intersection(removedNodeIds);
					if(upperBoundsToRemove.size > 0) {
						const reducedPentagon = pentagon.create(pentagon.value);
						for(const bound of upperBoundsToRemove.values()) {
							reducedPentagon.value.upperBounds.remove(bound);
						}
						// Manually set the value as we do not want to trigger the reduction for every set,
						// as we apply the reduction at the end.
						(minifiedDomain.value as Map<NodeId, ClosedPentagonValueDomain>).set(key, reducedPentagon);
					}
				}
			}
		}

		return state.create(ClosedPentagonDomain.reduce(minifiedDomain.value));
	}

	protected override onNumberConstant({ vertex, node }: { vertex: DataflowGraphVertexValue, node: RNumber<ParentInformation> }) {
		super.onNumberConstant({ vertex, node });

		if(node.content.complexNumber) {
			// For complex numbers, we do not perform interval analysis.
			numericInferenceLogger.warn(`NumericInferenceVisitor: Skipping complex number constant at node ID ${node.info.id}`);
			return;
		}

		if(node.content.markedAsInt) {
			numericInferenceLogger.warn(`NumericInferenceVisitor: Numbers are tracked as floating-point values, therefore precision might be lost for integer at node ID ${node.info.id}`);
		}

		if(Number.isNaN(node.content.num)) {
			// NaN is part of the general Top, which is represented as undefined in the state abstract domain, so we can just skip it here.
			return;
		}

		const pentagon = new ClosedPentagonValueDomain({
			interval:    IntervalDomain.scalar(node.content.num, this.config.ctx.config.abstractInterpretation.numeric.significantFigures),
			upperBounds: UpperBoundsValueDomain.top()
		});
		this.currentState.set(node.info.id, pentagon);
	}

	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }) {
		super.onFunctionCall({ call });

		if(this.currentState.isBottom()) {
			return;
		}

		const result = applyPentagonExpressionSemantics(call.id, call.name, call.args, this, this.currentState, this.config.ctx.config.abstractInterpretation.numeric.significantFigures);

		if(isUndefined(result)) {
			return;
		}

		return this.currentState.set(call.id, result);
	}

	setInterval(state: ClosedPentagonDomain, node: NodeId, value: (IntervalDomain | undefined)): void {
		if(isUndefined(value)) {
			state.remove(node);
		} else {
			let pentagon = state.get(node);
			if(isUndefined(pentagon)) {
				pentagon = ClosedPentagonValueDomain.top();
			}
			pentagon.value.interval = value;
			state.set(node, pentagon);
		}
	}

	getInterval(node: NodeId, state?: ClosedPentagonDomain): IntervalDomain | undefined {
		return this.getAbstractValue(node, state)?.value.interval;
	}

	setUpperBounds(state: ClosedPentagonDomain, node: NodeId, value: UpperBoundsValueDomain): void {
		const pentagon = state.get(node);
		if(isUndefined(pentagon)) {
			// As we currently cannot describe that we have upper bounds-info but not know whether it is a numeric scalar value, we cannot infer upper-bounds values for non-numeric scalar values.
			return;
		}
		pentagon.value.upperBounds = value.create(value.value);
		state.set(node, pentagon);
	}

	getUpperBounds(node: NodeId, state?: ClosedPentagonDomain): UpperBoundsValueDomain {
		return this.getAbstractValue(node, state)?.value.upperBounds ?? UpperBoundsValueDomain.top();
	}

	getOriginIfUnique(node: NodeId): NodeId | undefined {
		const origins = this.getVariableOrigins(node);
		if(origins.length === 0) {
			return node;
		}
		if(origins.length === 1) {
			return origins[0];
		}
		return undefined;
	}

	protected override applyConditionSemantics(state: ClosedPentagonDomain, conditionNodeId: NodeId, trueBranch: boolean): ClosedPentagonDomain {
		const { applyConditionSemantics: intervalPositiveSemantics, applyNegatedConditionSemantics: intervalNegativeSemantics } = getIntervalConditionSemantics<ClosedPentagonDomain, this>();
		const { applyConditionSemantics: upperBoundsPositiveSemantics, applyNegatedConditionSemantics: upperBoundsNegativeSemantics } = getUpperBoundsConditionSemantics<ClosedPentagonDomain, this>();

		const intervalSemantics = trueBranch ? intervalPositiveSemantics : intervalNegativeSemantics;
		const ubSemantics = trueBranch ? upperBoundsPositiveSemantics : upperBoundsNegativeSemantics;

		const conditionState = ubSemantics(
			conditionNodeId,
			intervalSemantics(
				conditionNodeId,
				state,
				this,
				this.config.dfg
			),
			this,
			this.config.dfg
		);

		return this.removeConstantAndExpressionInfo(conditionNodeId, conditionState);
	}
}