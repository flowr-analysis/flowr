import type { ControlFlowInformation } from './control-flow-graph';

import type { DataflowInformation } from '../dataflow/info';


import type { DataflowCfgGuidedVisitorConfiguration } from './dfg-cfg-guided-visitor';
import { DataflowAwareCfgGuidedVisitor } from './dfg-cfg-guided-visitor';
import type {
	NormalizedAst,
	ParentInformation
} from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SyntaxCfgGuidedVisitorConfiguration } from './syntax-cfg-guided-visitor';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { Origin } from '../dataflow/origin/dfg-get-origin';
import { getOriginInDfg } from '../dataflow/origin/dfg-get-origin';
import type {
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexFunctionDefinition,
	DataflowGraphVertexUse,
	DataflowGraphVertexValue,
	DataflowGraphVertexVariableDefinition
} from '../dataflow/graph/vertex';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { FunctionArgument } from '../dataflow/graph/graph';
import { edgeIncludesType, EdgeType } from '../dataflow/graph/edge';
import { guard } from '../util/assert';
import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { BuiltInProcessorMapper } from '../dataflow/environments/built-in';



export interface SemanticCfgGuidedVisitorConfiguration<
	OtherInfo = NoInfo,
	Cfg extends ControlFlowInformation    = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo>  = NormalizedAst<OtherInfo>,
	Dfg extends DataflowInformation       = DataflowInformation
> extends DataflowCfgGuidedVisitorConfiguration<Cfg, Dfg>, SyntaxCfgGuidedVisitorConfiguration<OtherInfo, Cfg, Ast> {
}

/**
 * This visitor extends on the {@link DataflowAwareCfgGuidedVisitor} by dispatching visitors for separate function calls as well,
 * providing more information!
 * In a way, this is the mixin of syntactic and dataflow guided visitation.
 *
 * Overwrite the functions starting with `on` to implement your logic.
 * In general, there is just one special case that you need to be aware of:
 *
 * In the context of a function call, flowR may be unsure to which origin the call relate!
 * Consider the following example:
 *
 * ```r
 * if(u) foo <- library else foo <- rm
 * foo(x)
 * ```
 *
 * Obtaining the origins of the call to `foo` will return both built-in functions `library` and `rm`.
 * The general semantic visitor cannot decide on how to combine these cases,
 * and it is up to your overload of {@link SemanticCfgGuidedVisitor#onDispatchFunctionCallOrigins|onDispatchFunctionCallOrigins}
 * to decide how to handle this.
 *
 * Use {@link BasicCfgGuidedVisitor#start} to start the traversal.
 */
export class SemanticCfgGuidedVisitor<
	OtherInfo = NoInfo,
    Cfg extends ControlFlowInformation   = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo> = NormalizedAst<OtherInfo>,
	Dfg extends DataflowInformation      = DataflowInformation,
	Config extends SemanticCfgGuidedVisitorConfiguration<OtherInfo, Cfg, Ast, Dfg> = SemanticCfgGuidedVisitorConfiguration<OtherInfo, Cfg, Ast, Dfg>
> extends DataflowAwareCfgGuidedVisitor<Cfg, Dfg, Config> {

	/**
	 * A helper function to get the normalized AST node for the given id or fail if it does not exist.
	 */
	protected getNormalizedAst(id: NodeId): RNode<OtherInfo & ParentInformation> | undefined {
		return this.config.normalizedAst.idMap.get(id);
	}

	protected override visitValue(val: DataflowGraphVertexValue) {
		super.visitValue(val);
		const astNode = this.getNormalizedAst(val.id);
		if(!astNode) {
			return;
		}
		switch(astNode.type) {
			case RType.String:  return this.onStringConstant({ vertex: val, node: astNode });
			case RType.Number:  return this.onNumberConstant({ vertex: val, node: astNode });
			case RType.Logical: return this.onLogicalConstant({ vertex: val, node: astNode });
			case RType.Symbol:
				guard(astNode.lexeme === 'NULL', `Expected NULL constant, got ${astNode.lexeme}`);
				return this.onNullConstant({ vertex: val, node: astNode as RSymbol<OtherInfo & ParentInformation, 'NULL'> });
		}
		guard(false, `Unexpected value type ${astNode.type} for value ${astNode.lexeme}`);
	}

	protected override visitVariableUse(vertex: DataflowGraphVertexUse) {
		super.visitVariableUse(vertex);
		this.onVariableUse({ vertex });
	}

	protected override visitVariableDefinition(vertex: DataflowGraphVertexVariableDefinition) {
		super.visitVariableDefinition(vertex);
		this.onVariableDefinition({ vertex });
	}

	protected override visitFunctionDefinition(vertex: DataflowGraphVertexFunctionDefinition): void {
		super.visitFunctionDefinition(vertex);
		this.onFunctionDefinition({ vertex });
	}

	protected override visitFunctionCall(vertex: DataflowGraphVertexFunctionCall) {
		super.visitFunctionCall(vertex);
		if(vertex.origin === 'unnamed') {
			this.onUnnamedCall({ vertex });
		} else {
			this.onDispatchFunctionCallOrigins(vertex, vertex.origin);
		}
	}

	/**
	 * Given a function call that has multiple targets (e.g., two potential built-in definitions).
	 * This function is responsible for calling {@link onDispatchFunctionCallOrigin} for each of the origins,
	 * and aggregating their results (which is just additive by default).
	 * If you want to change the behavior in case of multiple potential function definition targets, simply overwrite this function
	 * with the logic you desire.
	 *
	 * @protected
	 */
	protected onDispatchFunctionCallOrigins(call: DataflowGraphVertexFunctionCall, origins: readonly string[]) {
		for(const origin of origins) {
			this.onDispatchFunctionCallOrigin(call, origin);
		}
	}

	/**
	 * This function is responsible for dispatching the appropriate event
	 * based on a given dataflow vertex. The default serves as a backend
	 * for the event functions, but you may overwrite and extend this function at will.
	 *
	 * @see {@link onDispatchFunctionCallOrigins} for the aggregation in case the function call target is ambiguous.
	 *
	 * @protected
	 */
	protected onDispatchFunctionCallOrigin(call: DataflowGraphVertexFunctionCall, origin: keyof typeof BuiltInProcessorMapper | string) {
		switch(origin) {
			case 'builtin:eval':
				return this.onEvalFunctionCall({ call });
			case 'builtin:apply':
				return this.onApplyFunctionCall({ call });
			case 'builtin:expression-list':
				return this.onExpressionList({ call });
			case 'builtin:source':
				return this.onSourceCall({ call });
			case 'builtin:access':
				return this.onAccessCall({ call });
			case 'builtin:if-then-else':
				return this.onIfThenElseCall({ call, condition: call.args[0], then: call.args[1], else: call.args[2] });
			case 'builtin:get':
				return this.onGetCall({ call });
			case 'builtin:rm':
				return this.onRmCall({ call });
			case 'builtin:list':
				return this.onListCall({ call });
			case 'builtin:vector':
				return this.onVectorCall({ call });
			case 'table:assign':
			case 'builtin:assignment': {
				const outgoing = this.config.dataflow.graph.outgoingEdges(call.id);
				if(outgoing) {
					const target = [...outgoing.entries()].filter(([, e]) => edgeIncludesType(e.types, EdgeType.Returns));
					if(target.length === 1) {
						const targetOut = this.config.dataflow.graph.outgoingEdges(target[0][0]);
						if(targetOut) {
							const source = [...targetOut.entries()].filter(([t, e]) => edgeIncludesType(e.types, EdgeType.DefinedBy) && t !== call.id);
							if(source.length === 1) {
								return this.onAssignmentCall({ call, target: target[0][0], source: source[0][0] });
							}
						}
					}
				}
				return this.onAssignmentCall({ call, target: undefined, source: undefined });
			}
			case 'builtin:special-bin-op':
				return this.onSpecialBinaryOpCall({ call });
			case 'builtin:pipe':
				return this.onPipeCall({ call });
			case 'builtin:quote':
				return this.onQuoteCall({ call });
			case 'builtin:for-loop':
				return this.onForLoopCall({ call, variable: call.args[0], vector: call.args[1], body: call.args[2] });
			case 'builtin:repeat-loop':
				return this.onRepeatLoopCall({ call, body: call.args[0] });
			case 'builtin:while-loop':
				return this.onWhileLoopCall({ call, condition: call.args[0], body: call.args[1] });
			case 'builtin:replacement':
				return this.onReplacementCall({ call });
			case 'builtin:library':
				return this.onLibraryCall({ call });
			case 'builtin:default':
			default:
				return this.onDefaultFunctionCall({ call });
		}
	}


	/**
	 * A helper function to request the {@link getOriginInDfg|origins} of the given node.
	 */
	protected getOrigins(id: NodeId): Origin[] | undefined {
		return getOriginInDfg(this.config.dataflow.graph, id);
	}

	/** Called for every occurrence of a `NULL` in the program. */
	protected onNullConstant(_data: { vertex: DataflowGraphVertexValue, node: RSymbol<OtherInfo & ParentInformation, 'NULL'> }) {}

	/**
	 * Called for every constant string value in the program.
	 *
	 * For example, `"Hello World"` in `print("Hello World")`.
	 */
	protected onStringConstant(_data: { vertex: DataflowGraphVertexValue, node: RString }) {}

	/**
	 * Called for every constant number value in the program.
	 *
	 * For example, `42` in `print(42)`.
	 */
	protected onNumberConstant(_data: { vertex: DataflowGraphVertexValue, node: RNumber }) {}

	/**
	 * Called for every constant logical value in the program.
	 *
	 * For example, `TRUE` in `if(TRUE) { ... }`.
	 */
	protected onLogicalConstant(_data: { vertex: DataflowGraphVertexValue, node: RLogical }) {}

	/**
	 * Called for every variable that is read within the program.
	 * You can use {@link getOrigins} to get the origins of the variable.
	 *
	 * For example, `x` in `print(x)`.
	 */
	protected onVariableUse(_data: { vertex: DataflowGraphVertexUse }) {}

	/**
	 * Called for every variable that is written within the program.
	 * You can use {@link getOrigins} to get the origins of the variable.
	 *
	 * For example, `x` in `x <- 42` or `x` in `assign("x", 42)`.
	 */
	protected onVariableDefinition(_data: { vertex: DataflowGraphVertexVariableDefinition }) {}

	/**
	 * Called for every anonymous function definition.
	 *
	 * For example, `function(x) { x + 1 }` in `lapply(1:10, function(x) { x + 1 })`.
	 */
	protected onFunctionDefinition(_data: { vertex: DataflowGraphVertexFunctionDefinition }) {}

	/**
	 * This event triggers for every anonymous call within the program.
	 *
	 * For example, `(function(x) { x + 1 })(42)` or the second call in `a()()`.
	 *
	 * @protected
	 */
	protected onUnnamedCall(_data: { vertex: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every function call that is not handled by a specific overload,
	 * and hence may be a function that targets a user-defined function.
	 * Use {@link SemanticCfgGuidedVisitor#getOrigins} to get the origins of the call.
	 *
	 * For example, this triggers for `foo(x)` in
	 *
	 * ```r
	 * foo <- function(x) { x + 1 }
	 * foo(x)
	 * ```
	 *
	 * @protected
	 */
	protected onDefaultFunctionCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every call to the `eval` function.
	 *
	 * For example, `eval` in `eval(parse(text = "x + 1"))`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 *
	 * @protected
	 */
	protected onEvalFunctionCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every call to any of the `*apply` functions.
	 *
	 * For example, `lapply` in `lapply(1:10, function(x) { x + 1 })`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 *
	 * @protected
	 */
	protected onApplyFunctionCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	/**
	 * This event triggers for every expression list - implicit or explicit, _but_ not for the root program (see {@link SemanticCfgGuidedVisitor#onProgram
	 *
	 * @param _data
	 * @protected
	 */
	protected onExpressionList(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onSourceCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onAccessCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onIfThenElseCall(_data: { call: DataflowGraphVertexFunctionCall, condition: FunctionArgument, then: FunctionArgument, else: FunctionArgument | undefined }) {
	}

	protected onGetCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onRmCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onLibraryCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onAssignmentCall(_data: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }) {
	}

	protected onSpecialBinaryOpCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onPipeCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onQuoteCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onForLoopCall(_data: { call: DataflowGraphVertexFunctionCall, variable: FunctionArgument, vector: FunctionArgument, body: FunctionArgument }) {
	}

	protected onWhileLoopCall(_data: { call: DataflowGraphVertexFunctionCall, condition: FunctionArgument, body: FunctionArgument }) {
	}

	protected onRepeatLoopCall(_data: { call: DataflowGraphVertexFunctionCall, body: FunctionArgument }) {
	}

	protected onReplacementCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onListCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onVectorCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}
}