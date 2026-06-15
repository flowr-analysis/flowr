import type { Identifier } from '../dataflow/environments/identifier';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ResolvedTaint } from './function-mapper';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { RNamedFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';

interface LoggedFnCallInfo {
	mappedCalls:   MappedCallInfo[],
	unmappedCalls: CallInfo[],
}

interface CallInfo {
	functionName: Identifier,
	nodeId:       NodeId,
	file:         string | undefined,
	line:         string | undefined,
}

interface MappedCallInfo extends CallInfo {
	taint: string
}

/**
 * Collects internal information from the taint analysis using its hook system.
 * To collect all function call mappings during taint analysis,
 * pass the {@link TaintAnalysisInstrumentation.fnCallHook} to {@link TaintAnalysis.withHook}.
 * Get all mappings after running the taint analysis from {@link TaintAnalysisInstrumentation.trace}
 */
export class TaintAnalysisInstrumentation {
	private readonly _trace: Map<string, LoggedFnCallInfo> = new Map();

	get trace() {
		return this._trace;
	}

	fnCallHook = (name: string, taint: ResolvedTaint<AnyAbstractDomain>, node: RNamedFunctionCall<ParentInformation>, value: AnyAbstractDomain) => {
		const existent = this._trace.get(name);
		if(!existent) {
			this._trace.set(name, { mappedCalls: [], unmappedCalls: [] });
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
	};
}