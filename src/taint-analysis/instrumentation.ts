import type { Identifier } from '../dataflow/environments/identifier';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

interface InstrumentationData {
	mappedCalls:   InstrumentedCall[],
	unmappedCalls: InstrumentedCall[],
}

interface InstrumentedCall {
	functionName: Identifier,
	nodeId:       NodeId,
	file:         string | undefined,
	line:         string | undefined,
}

interface MappedCall extends InstrumentedCall {
	taint: string
}

export class Instrumentation {
	private readonly data: InstrumentationData = {
		mappedCalls:   [],
		unmappedCalls: []
	};

	public recordMappedCall(call: MappedCall) {
		this.data.mappedCalls.push(call);
	}

	public recordUnmappedCall(call: InstrumentedCall) {
		this.data.unmappedCalls.push(call);
	}
}