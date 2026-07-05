import type { Identifier } from '../../dataflow/environments/identifier';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FnCallHookInfo } from '../builder/taint-analysis';
import { getFunctionArguments } from '../../abstract-interpretation/data-frame/mappers/arguments';
import { resolveIdToArgName, resolveIdToArgValue } from '../../abstract-interpretation/data-frame/resolve-args';
import { VariableResolve } from '../../config';
import type { RNamedFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { ArgTaintProjector } from '../taint-visitor';

export interface LoggedFnCallInfo {
	mappedCalls:   MappedCallInfo[],
	unmappedCalls: CallInfo[],
}

interface ArgInfo {
	name?:  string,
	value?: string | number | boolean | (string | number | boolean)[],
	/** The incoming taint of the argument, resolved for every argument regardless of mapping rules. */
	taint?: string,
}

interface CallInfo {
	functionName: Identifier,
	nodeId:       NodeId,
	line:         string | undefined,
	/** All arguments of the call (name, resolved value, and incoming taint). */
	args:         ArgInfo[],
}

interface MappedCallInfo extends CallInfo {
	taint: unknown
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

	fnCallHook = ({ name, taint, node, value, projectArg, dfg, ctx }: FnCallHookInfo) => {
		const fnCallInfo = this.addFile(name, node);
		const call: CallInfo = {
			line:         node.info.fullRange?.[0].toString(),
			nodeId:       node.info.id,
			functionName: node.functionName.content,
			args:         this.evaluateArguments(dfg, ctx, node, projectArg),
		};
		if(taint) {
			fnCallInfo.mappedCalls.push({ ...call, taint: value.toJson() });
		} else {
			fnCallInfo.unmappedCalls.push(call);
		}
	};

	private addFile(name: string, node: RNamedFunctionCall<ParentInformation>) {
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
		return fnCallInfo;
	}

	private evaluateArguments(dfg: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, node: RNamedFunctionCall<ParentInformation>, projectArg: ArgTaintProjector) {
		const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias, ctx: ctx };
		return getFunctionArguments(node, dfg).map(arg => {
			const resolvable = arg === EmptyArgument ? undefined : arg;
			const valueId = resolvable?.value?.info?.id;
			return {
				name:  resolveIdToArgName(resolvable, resolveInfo),
				value: resolveIdToArgValue(resolvable, resolveInfo),
				taint: valueId === undefined ? undefined : projectArg(valueId)?.toString(),
			};
		});
	}

}
