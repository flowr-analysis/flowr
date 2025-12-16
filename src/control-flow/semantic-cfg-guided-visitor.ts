import type { CfgExpressionVertex, CfgStatementVertex, ControlFlowInformation } from './control-flow-graph';
import { type DataflowCfgGuidedVisitorConfiguration , DataflowAwareCfgGuidedVisitor } from './dfg-cfg-guided-visitor';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SyntaxCfgGuidedVisitorConfiguration } from './syntax-cfg-guided-visitor';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type Origin , getOriginInDfg } from '../dataflow/origin/dfg-get-origin';
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
import type { DataflowGraph, FunctionArgument } from '../dataflow/graph/graph';
import { edgeIncludesType, EdgeType } from '../dataflow/graph/edge';
import { guard } from '../util/assert';
import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { BuiltInProcessorMapper } from '../dataflow/environments/built-in';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ReadOnlyFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';

export interface SemanticCfgGuidedVisitorConfiguration<
	OtherInfo = NoInfo,
	ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo>       = NormalizedAst<OtherInfo>,
	Dfg extends DataflowGraph                  = DataflowGraph
> extends DataflowCfgGuidedVisitorConfiguration<ControlFlow, Dfg>, SyntaxCfgGuidedVisitorConfiguration<OtherInfo, ControlFlow, Ast> {
	readonly ctx: ReadOnlyFlowrAnalyzerContext;
}

/**
 * This visitor extends on the {@link DataflowAwareCfgGuidedVisitor} by dispatching visitors for separate function calls as well,
 * providing more information!
 * In a way, this is the mixin of syntactic and dataflow guided visitation.
 *
 * Overwrite the functions starting with `on` to implement your logic.
 * In general, there is just one special case that you need to be aware of:
 *
 * In the context of a function call, flowR may be unsure to which origin the call relates!
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
    ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo>       = NormalizedAst<OtherInfo>,
	Dfg extends DataflowGraph                  = DataflowGraph,
	Config extends SemanticCfgGuidedVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dfg> = SemanticCfgGuidedVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dfg>
> extends DataflowAwareCfgGuidedVisitor<ControlFlow, Dfg, Config> {

	/**
	 * A helper function to get the normalized AST node for the given id or fail if it does not exist.
	 */
	protected getNormalizedAst(id: NodeId | undefined): RNode<OtherInfo & ParentInformation> | undefined {
		return id !== undefined ? this.config.normalizedAst.idMap.get(id) : undefined;
	}

	/**
	 * See {@link DataflowAwareCfgGuidedVisitor#visitValue} for the base implementation.
	 * This now dispatches the value to the appropriate event handler based on its type.
	 */
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
				if(astNode.lexeme === 'NULL') {
					return this.onNullConstant({
						vertex: val,
						node:   astNode as RSymbol<OtherInfo & ParentInformation, 'NULL'>
					});
				} else {
					return this.onSymbolConstant({ vertex: val, node: astNode as RSymbol<OtherInfo & ParentInformation> });
				}

		}
		guard(false, `Unexpected value type ${astNode.type} for value ${astNode.lexeme}`);
	}

	/**
	 * See {@link DataflowAwareCfgGuidedVisitor#visitVariableUse} for the base implementation.
	 *
	 * This function is called for every use of a variable in the program and dispatches the appropriate event.
	 * You probably do not have to overwrite it and just use {@link SemanticCfgGuidedVisitor#onVariableUse|`onVariableUse`} instead.
	 * @protected
	 */
	protected override visitVariableUse(vertex: DataflowGraphVertexUse) {
		super.visitVariableUse(vertex);
		this.onVariableUse({ vertex });
	}

	/**
	 * See {@link DataflowAwareCfgGuidedVisitor#visitVariableDefinition} for the base implementation.
	 *
	 * This function is called for every variable definition in the program and dispatches the appropriate event.
	 * You probably do not have to overwrite it and just use {@link SemanticCfgGuidedVisitor#onVariableDefinition|`onVariableDefinition`} instead.
	 * @protected
	 */
	protected override visitVariableDefinition(vertex: DataflowGraphVertexVariableDefinition) {
		super.visitVariableDefinition(vertex);
		this.onVariableDefinition({ vertex });
	}

	/**
	 * See {@link DataflowAwareCfgGuidedVisitor#visitFunctionDefinition} for the base implementation.
	 *
	 * This function is called for every function definition in the program and dispatches the appropriate event.
	 * You probably do not have to overwrite it and just use {@link SemanticCfgGuidedVisitor#onFunctionDefinition|`onFunctionDefinition`} instead.
	 * @protected
	 */
	protected override visitFunctionDefinition(vertex: DataflowGraphVertexFunctionDefinition): void {
		super.visitFunctionDefinition(vertex);
		const ast = this.getNormalizedAst(vertex.id);
		if(ast?.type === RType.FunctionDefinition) {
			this.onFunctionDefinition({ vertex, parameters: ast.parameters.map(p => p.info.id) });
		} else {
			this.onFunctionDefinition({ vertex });
		}
	}

	/**
	 * See {@link DataflowAwareCfgGuidedVisitor#visitFunctionCall} for the base implementation.
	 *
	 * This function is called for every function call in the program and dispatches the appropriate event.
	 * You probably do not have to overwrite it and just use {@link SemanticCfgGuidedVisitor#onUnnamedCall|`onUnnamedCall`} for anonymous calls,
	 * or {@link SemanticCfgGuidedVisitor#onDispatchFunctionCallOrigins|`onDispatchFunctionCallOrigins`} for named calls (or just overwrite
	 * the events you are interested in directly).
	 * @protected
	 */
	protected override visitFunctionCall(vertex: DataflowGraphVertexFunctionCall) {
		super.visitFunctionCall(vertex);
		if(vertex.origin === 'unnamed') {
			this.onUnnamedCall({ call: vertex });
		} else {
			this.onDispatchFunctionCallOrigins(vertex, vertex.origin);
		}
	}


	/**
	 * See {@link DataflowAwareCfgGuidedVisitor#visitUnknown} for the base implementation.
	 * This function is called for every unknown vertex in the program.
	 * It dispatches the appropriate event based on the type of the vertex.
	 * In case you have to overwrite this function please make sure to still call this implementation to get a correctly working {@link SemanticCfgGuidedVisitor#onProgram|`onProgram`}.
	 * @protected
	 */
	protected override visitUnknown(vertex: CfgStatementVertex | CfgExpressionVertex) {
		super.visitUnknown(vertex);
		const ast = this.getNormalizedAst(vertex.id);
		if(ast && ast.type === RType.ExpressionList && ast.info.parent === undefined) {
			this.onProgram(ast);
		}
	}

	/**
	 * Given a function call that has multiple targets (e.g., two potential built-in definitions).
	 * This function is responsible for calling {@link onDispatchFunctionCallOrigin} for each of the origins,
	 * and aggregating their results (which is just additive by default).
	 * If you want to change the behavior in case of multiple potential function definition targets, simply overwrite this function
	 * with the logic you desire.
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
	 * @see {@link onDispatchFunctionCallOrigins} for the aggregation in case the function call target is ambiguous.
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
			case 'builtin:if-then-else': {
				// recover dead arguments from ast
				const ast = this.getNormalizedAst(call.id);
				if(!ast || ast.type !== RType.IfThenElse) {
					return this.onIfThenElseCall({
						call,
						condition: call.args[0] === EmptyArgument ? undefined : call.args[0].nodeId,
						then:      call.args[1] === EmptyArgument ? undefined : call.args[1].nodeId,
						else:      call.args[2] === EmptyArgument ? undefined : call.args[2].nodeId
					});
				} else {
					return this.onIfThenElseCall({
						call,
						condition: ast.condition.info.id,
						then:      ast.then.info.id,
						else:      ast.otherwise?.info.id
					});
				}
			}
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
				const outgoing = this.config.dfg.outgoingEdges(call.id);
				if(outgoing) {
					const target = [...outgoing.entries()].filter(([, e]) => edgeIncludesType(e.types, EdgeType.Returns));
					if(target.length === 1) {
						const targetOut = this.config.dfg.outgoingEdges(target[0][0]);
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
				if(call.args.length !== 2) {
					return this.onSpecialBinaryOpCall({ call });
				}
				return this.onSpecialBinaryOpCall({ call, lhs: call.args[0], rhs: call.args[1] });
			case 'builtin:pipe':
				if(call.args.length !== 2) {
					return this.onPipeCall({ call });
				}
				return this.onPipeCall({ call, lhs: call.args[0], rhs: call.args[1] });
			case 'builtin:quote':
				return this.onQuoteCall({ call });
			case 'builtin:for-loop':
				return this.onForLoopCall({ call, variable: call.args[0], vector: call.args[1], body: call.args[2] });
			case 'builtin:repeat-loop':
				return this.onRepeatLoopCall({ call, body: call.args[0] });
			case 'builtin:while-loop':
				return this.onWhileLoopCall({ call, condition: call.args[0], body: call.args[1] });
			case 'builtin:replacement': {
				const outgoing = this.config.dfg.outgoingEdges(call.id);
				if(outgoing) {
					const target = [...outgoing.entries()].filter(([, e]) => edgeIncludesType(e.types, EdgeType.Returns));
					if(target.length === 1) {
						const targetOut = this.config.dfg.outgoingEdges(target[0][0]);
						if(targetOut) {
							const source = [...targetOut.entries()].filter(([t, e]) => edgeIncludesType(e.types, EdgeType.DefinedBy) && t !== call.id);
							if(source.length === 1) {
								return this.onReplacementCall({ call, target: target[0][0], source: source[0][0] });
							}
						}
					}
				}
				return this.onReplacementCall({ call, target: undefined, source: undefined });
			}
			case 'builtin:library':
				return this.onLibraryCall({ call });
			case 'builtin:default':
			default:
				return this.onDefaultFunctionCall({ call });
		}
	}

	/**
	 * This event is called for the root program node, i.e., the program that is being analyzed.
	 * @protected
	 */
	protected onProgram(_data: RExpressionList<OtherInfo>) {}


	/**
	 * A helper function to request the {@link getOriginInDfg|origins} of the given node.
	 */
	protected getOrigins(id: NodeId): Origin[] | undefined {
		return getOriginInDfg(this.config.dfg, id);
	}

	/**
	 * Called for every occurrence of a `NULL` in the program.
	 *
	 * For other symbols that are not referenced as a variable, see {@link SemanticCfgGuidedVisitor#onSymbolConstant|`onSymbolConstant`}.
	 */
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
	 * Called for every constant symbol value in the program.
	 *
	 * For example, `foo` in `library(foo)` or `a` in `l$a`. This most likely happens as part of non-standard-evaluation, i.e., the symbol is not evaluated to a value,
	 * but used as a symbol in and of itself.
	 *
	 * Please note, that due to its special behaviors, `NULL` is handled in {@link SemanticCfgGuidedVisitor#onNullConstant|`onNullConstant`} and not here.
	 */
	protected onSymbolConstant(_data: { vertex: DataflowGraphVertexValue, node: RSymbol }) {}

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
	 * See {@link SemanticCfgGuidedVisitor#onAssignmentCall} for the assignment call. This event handler also provides you with information on the source.
	 */
	protected onVariableDefinition(_data: { vertex: DataflowGraphVertexVariableDefinition }) {}

	/**
	 * Called for every anonymous function definition.
	 *
	 * For example, `function(x) { x + 1 }` in `lapply(1:10, function(x) { x + 1 })`.
	 */
	protected onFunctionDefinition(_data: { vertex: DataflowGraphVertexFunctionDefinition, parameters?: readonly NodeId[] }) {}

	/**
	 * This event triggers for every anonymous call within the program.
	 *
	 * For example, `(function(x) { x + 1 })(42)` or the second call in `a()()`.
	 *
	 * This is separate from {@link SemanticCfgGuidedVisitor#onDefaultFunctionCall|`onDefaultFunctionCall`} which is used for named function calls that do not trigger any of these events.
	 * The main differentiation for these calls is that you may not infer their semantics from any name alone and probably _have_
	 * to rely on {@link SemanticCfgGuidedVisitor#getOrigins|`getOrigins`} to get more information.
	 * @protected
	 */
	protected onUnnamedCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every function call that is not handled by a specific overload,
	 * and hence may be a function that targets a user-defined function. In a way, these are functions that are named,
	 * but flowR does not specifically care about them (currently) wrt. to their dataflow impact.
	 *
	 * Use {@link SemanticCfgGuidedVisitor#getOrigins|`getOrigins`} to get the origins of the call.
	 *
	 * For example, this triggers for `foo(x)` in
	 *
	 * ```r
	 * foo <- function(x) { x + 1 }
	 * foo(x)
	 * ```
	 *
	 * This explicitly will not trigger for scenarios in which the function has no name (i.e., if it is anonymous).
	 * For such cases, you may rely on the {@link SemanticCfgGuidedVisitor#onUnnamedCall|`onUnnamedCall`} event.
	 * The main reason for this separation is part of flowR's handling of these functions, as anonymous calls cannot be resolved using the active environment.
	 * @protected
	 */
	protected onDefaultFunctionCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every call to the `eval` function.
	 *
	 * For example, `eval` in `eval(parse(text = "x + 1"))`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onEvalFunctionCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every call to any of the `*apply` functions.
	 *
	 * For example, `lapply` in `lapply(1:10, function(x) { x + 1 })`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onApplyFunctionCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every expression list - implicit or explicit, _but_ not for the root program (see {@link SemanticCfgGuidedVisitor#onProgram|`onProgram`} for that).
	 *
	 * For example, this triggers for the expression list created by `{` and `}` in `ìf (TRUE) { x <- 1; y <- 2; }`. But also for the implicit
	 * expression list `x <- x + 1` in `for(x in 1:10) x <- x + 1`.
	 * @protected
	 */
	protected onExpressionList(_data: { call: DataflowGraphVertexFunctionCall }) {}


	/**
	 * This event triggers for every call to the `source` function.
	 *
	 * For example, `source` in `source("script.R")`.
	 *
	 * By default, this does not provide the resolved source file. Yet you can access the {@link DataflowGraph} to ask for sourced files.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onSourceCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every subsetting call, i.e., for every call to `[[`, `[`, or `$`.
	 * @protected
	 */
	protected onAccessCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every call to the `if` function, which is used to implement the `if-then-else` control flow.
	 * @protected
	 */
	protected onIfThenElseCall(_data: { call: DataflowGraphVertexFunctionCall, condition: NodeId | undefined, then: NodeId | undefined, else: NodeId | undefined }) {}

	/**
	 * This event triggers for every call to the `get` function, which is used to access variables in the global environment.
	 *
	 * For example, `get` in `get("x")`.
	 *
	 * Please be aware, that with flowR resolving the `get` during the dataflow analysis,
	 * this may very well trigger a {@link SemanticCfgGuidedVisitor#onVariableUse|`onVariableUse`} event as well.
	 * @protected
	 */
	protected onGetCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every call to the `rm` function, which is used to remove variables from the environment.
	 *
	 * For example, `rm` in `rm(x)`.
	 * @protected
	 */
	protected onRmCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every call to a function which loads a library.
	 *
	 * For example, `library` in `library(dplyr)`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onLibraryCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every assignment call, i.e., for every call to `<-` or `=` that assigns a value to a variable.
	 *
	 * For example, this triggers for `<-` in `x <- 42` or `assign` in `assign("x", 42)`.
	 * This also triggers for the `data.table` assign `:=` active within subsetting calls, e.g., `DT[, x := 42]`.
	 *
	 * Please be aware that replacements (e.g. assignments with a function call on the target side) like `names(x) <- 3` are subject to {@link SemanticCfgGuidedVisitor#onReplacementCall|`onReplacementCall`} instead.
	 * @protected
	 */
	protected onAssignmentCall(_data: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }) {}

	/**
	 * This event triggers for every call to a special binary operator, i.e., every binary function call that starts and ends with a `%` sign.
	 *
	 * For example, this triggers for`%in%` in `x %in% y`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onSpecialBinaryOpCall(_data: { call: DataflowGraphVertexFunctionCall, lhs?: FunctionArgument, rhs?: FunctionArgument }) {}

	/**
	 * This event triggers for every call to R's pipe operator, i.e., for every call to `|>`.
	 * @protected
	 */
	protected onPipeCall(_data: { call: DataflowGraphVertexFunctionCall, lhs?: FunctionArgument, rhs?: FunctionArgument }) {}


	/**
	 * This event triggers for every call to the `quote` function, which is used to quote expressions.
	 *
	 * For example, `quote` in `quote(x + 1)`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onQuoteCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every call to the `for` loop function, which is used to implement the `for` loop control flow.
	 *
	 * For example, this triggers for `for` in `for(i in 1:10) { print(i) }`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onForLoopCall(_data: { call: DataflowGraphVertexFunctionCall, variable: FunctionArgument, vector: FunctionArgument, body: FunctionArgument }) {}

	/**
	 * This event triggers for every call to the `while` loop function, which is used to implement the `while` loop control flow.
	 *
	 * For example, this triggers for `while` in `while(i < 10) { i <- i + 1 }`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onWhileLoopCall(_data: { call: DataflowGraphVertexFunctionCall, condition: FunctionArgument, body: FunctionArgument }) {}

	/**
	 * This event triggers for every call to the `repeat` loop function, which is used to implement the `repeat` loop control flow.
	 *
	 * For example, this triggers for `repeat` in `repeat { i <- i + 1; if(i >= 10) break }`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onRepeatLoopCall(_data: { call: DataflowGraphVertexFunctionCall, body: FunctionArgument }) {}

	/**
	 * This event triggers for every call to a function that replaces a value in a container, such as `names(x) <- 3`.
	 *
	 * This is different from {@link SemanticCfgGuidedVisitor#onAssignmentCall|`onAssignmentCall`} in that it does not assign a value to a variable,
	 * but rather replaces a value in a container.
	 *
	 * For example, this triggers for `names` in `names(x) <- 3`, but not for `x <- 3`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onReplacementCall(_data: { call: DataflowGraphVertexFunctionCall, source: NodeId | undefined, target: NodeId | undefined }) {}

	/**
	 * This event triggers for every call that (to the knowledge of flowr) constructs a (new) list.
	 *
	 * For example, this triggers for `list` in `list(1, 2, 3)`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onListCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/**
	 * This event triggers for every call that (to the knowledge of flowr) constructs a (new) vector.
	 *
	 * For example, this triggers for `c` in `c(1, 2, 3)`.
	 *
	 * More specifically, this relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 */
	protected onVectorCall(_data: { call: DataflowGraphVertexFunctionCall }) {}
}