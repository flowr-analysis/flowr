import { AbstractInterpretationVisitor } from '../absint-visitor';
import { IntervalDomain } from '../domains/interval-domain';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexValue } from '../../dataflow/graph/vertex';
import type { RNumber } from '../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { applyIntervalSemantics } from './semantics';
import { Identifier } from '../../dataflow/environments/identifier';
import { isUndefined } from '../../util/assert';

/**
 * The control flow graph visitor to infer scalar numeric values using abstract interpretation.
 */
export class NumericInferenceVisitor extends AbstractInterpretationVisitor<IntervalDomain> {
	protected override onNumberConstant({ vertex, node}: {
		vertex: DataflowGraphVertexValue;
		node:   RNumber<ParentInformation>
	}) {
		super.onNumberConstant({ vertex, node });

		if(node.content.complexNumber) {
			// For complex numbers, we do not perform interval analysis
			console.error(`NumericInferenceVisitor: Skipping complex number constant at node ID ${node.info.id}`);
			return;
		}

		const interval = new IntervalDomain([node.content.num, node.content.num]);
		this.currentState.set(node.info.id, interval);
	}

	protected override onFunctionCall({ call}: { call: DataflowGraphVertexFunctionCall }) {
		super.onFunctionCall({ call });

		const args = call.args.filter(arg => arg !== EmptyArgument).map(arg => this.getAbstractValue(arg.nodeId));

		const result = applyIntervalSemantics(Identifier.getName(call.name), args);

		if(isUndefined(result)) {
			return;
		}

		return this.currentState.set(call.id, result);
	}
}