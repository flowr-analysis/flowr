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
	line:         string | undefined,
}

interface MappedCallInfo extends CallInfo {
	taint: string
}

/**
 * Trace mapping: Analysis Name -\> File Name -\> FnCall Info
 */
type Trace = Map<string, Map<string | undefined, LoggedFnCallInfo>>;

/**
 * Collects internal information from the taint analysis using its hook system.
 * To collect all function call mappings during taint analysis,
 * pass the {@link TaintAnalysisInstrumentation.fnCallHook} to {@link TaintAnalysis.withHook}.
 * Get all mappings after running the taint analysis from {@link TaintAnalysisInstrumentation.trace}
 */
export class TaintAnalysisInstrumentation {
	private readonly _trace: Trace = new Map();

	get trace(): Trace {
		return this._trace;
	}

	fnCallHook = (name: string, taint: ResolvedTaint<AnyAbstractDomain>, node: RNamedFunctionCall<ParentInformation>, value: AnyAbstractDomain) => {
		let byFile = this._trace.get(name);
		if(!byFile) {
			byFile = new Map();
			this._trace.set(name, byFile);
		}

		const file = node.info.file;
		let fnCallInfo = byFile.get(file);
		if(!fnCallInfo) {
			fnCallInfo = { mappedCalls: [], unmappedCalls: [] };
			byFile.set(file, fnCallInfo);
		}

		const call = {
			line:         node.info.fullRange?.[0].toString(),
			nodeId:       node.info.id,
			functionName: node.functionName.content,
		};

		if(taint) {
			fnCallInfo.mappedCalls.push({ ...call, taint: value.toString() });
		} else {
			fnCallInfo.unmappedCalls.push(call);
		}
	};
}