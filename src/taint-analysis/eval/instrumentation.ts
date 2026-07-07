import { Identifier } from '../../dataflow/environments/identifier';
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
import { satisfiesCallTargets, CallTargets } from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { ControlDependency } from '../../dataflow/info';
import { happensInEveryBranch } from '../../dataflow/info';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';

export interface LoggedFnCallInfo {
	mappedCalls:   MappedCallInfo[],
	unmappedCalls: CallInfo[],
}

interface ArgInfo {
	name?:  string,
	value?: string | number | boolean | (string | number | boolean)[],
	/** The incoming taint of the argument, resolved for every argument regardless of mapping rules. */
	taint?: unknown,
}

interface ControlDependencyInfo extends ControlDependency {
	/** Resolved construct kind, e.g. 'if', 'for', 'while', 'repeat', '&&', '||', 'stopifnot'. */
	construct: string,
}

interface CallInfo {
	functionName:   Identifier,
	nodeId:         NodeId,
	line:           string | undefined,
	/** All arguments of the call (name, resolved value, and incoming taint). */
	args:           ArgInfo[],
	/**
	 * Locally-defined call targets (present only when the call resolves purely to local functions),
	 */
	localTargets?:  NodeId[],
	/** Control dependencies governing the execution of this call; absent if unconditional. */
	cds?:           ControlDependencyInfo[],
	/** Whether the cds are exhaustive (i.e., the call executes in every branch); only set when cds are present. */
	inEveryBranch?: boolean,
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

	fnCallHook = ({ name, taint, node, value, projectArg, call, dfg, ctx }: FnCallHookInfo) => {
		const fnCallInfo = this.addFile(name, node);
		const localTargets = satisfiesCallTargets(call, dfg, CallTargets.OnlyLocal);
		const cds = call.cds?.map(cd => resolveControlDependency(cd, dfg));
		const callInfo: CallInfo = {
			line:         node.info.fullRange?.[0].toString(),
			nodeId:       node.info.id,
			functionName: node.functionName.content,
			args:         this.evaluateArguments(dfg, ctx, node, projectArg),
			...(localTargets === 'no' ? {} : { localTargets }),
			...(cds?.length ? { cds, inEveryBranch: happensInEveryBranch(call.cds) } : {}),
		};
		if(taint) {
			fnCallInfo.mappedCalls.push({ ...callInfo, taint: value.toJSON() });
		} else {
			fnCallInfo.unmappedCalls.push(callInfo);
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
				taint: valueId === undefined ? undefined : projectArg(valueId)?.toJSON(),
			};
		});
	}

}

function resolveControlDependency(cd: ControlDependency, dfg: DataflowGraph): ControlDependencyInfo {
	return {
		id:          cd.id,
		construct:   classifyControlConstruct(cd, dfg),
		when:        cd.when,
		byIteration: cd.byIteration,
		file:        cd.file
	};
}

/**
 * Binary operators that lazily evaluate their rhs and thus act as control constructs.
 * See {@link BuiltInProcName.SpecialBinOp} operators in {@link DefaultBuiltinConfig}.
 */
const LazyBinaryOperators: ReadonlySet<string> = new Set(['&&', '&', '||', '|']);

/**
 * Resolves the construct that causes a control dependency. The cd id points either directly at the construct
 * (`if`, loops, lazy binary operators, `source`) or at a governing expression (e.g., a `stopifnot` condition or
 * a `tryCatch` block), for which the enclosing named call names the construct.
 */
function classifyControlConstruct(cd: ControlDependency, dfg: DataflowGraph): string {
	const node = dfg.idMap?.get(cd.id);
	if(node === undefined) {
		return 'unknown';
	}
	switch(node.type) {
		case RType.IfThenElse:   return 'if';
		case RType.ForLoop:      return 'for';
		case RType.WhileLoop:    return 'while';
		case RType.RepeatLoop:   return 'repeat';
		case RType.BinaryOp:
			if(LazyBinaryOperators.has(node.operator)) {
				return node.operator;
			}
			break;
		case RType.FunctionCall:
			// for file-exist assumptions (e.g. `source`)
			if(node.named && cd.file !== undefined) {
				return Identifier.toString(node.functionName.content);
			}
			break;
	}
	// the cd id is a governing expression (e.g., a `stopifnot` condition or a `tryCatch` block)
	// the nearest enclosing named call names the construct (intermediate nodes are skipped)
	for(let parent = parentNode(node, dfg); parent !== undefined; parent = parentNode(parent, dfg)) {
		if(parent.type === RType.FunctionCall && parent.named) {
			return Identifier.toString(parent.functionName.content);
		}
	}
	return node.type;
}

function parentNode(node: RNode<ParentInformation>, dfg: DataflowGraph): RNode<ParentInformation> | undefined {
	return node.info.parent === undefined ? undefined : dfg.idMap?.get(node.info.parent);
}
