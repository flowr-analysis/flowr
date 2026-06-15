import type { Identifier } from '../dataflow/environments/identifier';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ResolvedTaint } from './function-mapper';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { RNamedFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';

export type TaintAnalysisInstrumentationHook = (name: string, taint: ResolvedTaint<AnyAbstractDomain>, node: RNamedFunctionCall<ParentInformation>, value: AnyAbstractDomain) => void;

interface InstrumentationData {
	mappedCalls:   MappedCall[],
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

export class TaintAnalysisInstrumentation {
	private readonly _log: Map<string, InstrumentationData> = new Map();

	get log() {
		return this._log;
	}

	public hook(name: string, taint: ResolvedTaint<AnyAbstractDomain>, node: RNamedFunctionCall<ParentInformation>, value: AnyAbstractDomain) {
		const existent = this._log.get(name);
		if(!existent) {
			this._log.set(name, { mappedCalls: [], unmappedCalls: [] });
		}

		const call = {
			file:         node.info.file,
			line:         node.info.fullRange?.[0].toString(),
			nodeId:       node.info.id,
			functionName: node.functionName.content,
		};

		if(taint) {
			existent?.mappedCalls.push({ ...call, taint: value.toString() });
		} else {
			existent?.unmappedCalls.push(call);
		}
	}
}