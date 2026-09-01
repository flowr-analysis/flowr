import type { CfgExpressionVertex, CfgStatementVertex, ControlFlowInformation } from './control-flow-graph';
import { Resolve } from '../dataflow/environments/resolve-helper';
import { CfgVertex } from './control-flow-graph';
import { DataflowAwareCfgGuidedVisitor, type DataflowCfgGuidedVisitorConfiguration } from './dfg-cfg-guided-visitor';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SyntaxCfgGuidedVisitorConfiguration } from './syntax-cfg-guided-visitor';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { Origin } from '../dataflow/origin/dfg-get-origin';
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
import { DfEdge, EdgeType } from '../dataflow/graph/edge';
import { assertUnreachable, guard } from '../util/assert';
import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ReadOnlyFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { RNull } from '../r-bridge/lang-4.x/convert-values';
import { Dataflow } from '../dataflow/graph/df-helper';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import { NodeValue } from '../dataflow/eval/resolve/node-value';
import { isValue } from '../dataflow/eval/values/r-value';
import { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';

export interface SemanticCfgGuidedVisitorConfiguration<
	OtherInfo = NoInfo,
	ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo>       = NormalizedAst<OtherInfo>,
	Dfg extends DataflowGraph                  = DataflowGraph
> extends DataflowCfgGuidedVisitorConfiguration<ControlFlow, Dfg>, SyntaxCfgGuidedVisitorConfiguration<OtherInfo, ControlFlow, Ast> {
	readonly ctx: ReadOnlyFlowrAnalyzerContext;
}

/**
 * What every `on...Call` hook of the {@link SemanticCfgGuidedVisitor} receives: the call vertex it fired for.
 * Hooks that recognize more of the call's shape extend this with the parts they resolved.
 */
export interface OnCall {
	readonly call: DataflowGraphVertexFunctionCall;
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
		return id === undefined ? undefined : this.config.normalizedAst.idMap.get(id);
	}

	/**
	 * The logical the call's only argument resolves to, `undefined` if the call does not take exactly one
	 * argument or if that argument does not resolve to a single logical.
	 */
	protected getBoolArgValue(data: OnCall): boolean | undefined {
		if(data.call.args.length !== 1 || data.call.args[0] === EmptyArgument) {
			return undefined;
		}

		const value = NodeValue.soleOf(data.call.args[0].nodeId, Resolve.info(this.config.dfg, this.config.ctx), 'logical', { idMap: this.config.normalizedAst.idMap });
		return value !== undefined && isValue(value.value) ? Boolean(value.value) : undefined;
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
				if(astNode.lexeme === RNull) {
					return this.onNullConstant({
						vertex: val,
						node:   astNode as RSymbol<OtherInfo & ParentInformation, typeof RNull>
					});
				} else {
					return this.onSymbolConstant({ vertex: val, node: astNode });
				}

		}
		guard(false, `Unexpected value type ${astNode.type} for value ${astNode.lexeme}`);
	}

	/** Dispatches {@link SemanticCfgGuidedVisitor#onVariableUse|onVariableUse}; overwrite that instead of this base-dispatch override. */
	protected override visitVariableUse(vertex: DataflowGraphVertexUse) {
		super.visitVariableUse(vertex);
		this.onVariableUse({ vertex });
	}

	/** Dispatches {@link SemanticCfgGuidedVisitor#onVariableDefinition|onVariableDefinition}; overwrite that instead of this base-dispatch override. */
	protected override visitVariableDefinition(vertex: DataflowGraphVertexVariableDefinition) {
		super.visitVariableDefinition(vertex);
		this.onVariableDefinition({ vertex });
	}

	/** Dispatches {@link SemanticCfgGuidedVisitor#onFunctionDefinition|onFunctionDefinition}; overwrite that instead of this base-dispatch override. */
	protected override visitFunctionDefinition(vertex: DataflowGraphVertexFunctionDefinition): void {
		super.visitFunctionDefinition(vertex);
		const ast = this.getNormalizedAst(vertex.id);
		if(RFunctionDefinition.is(ast)) {
			this.onFunctionDefinition({ vertex, parameters: ast.parameters.map(p => p.info.id) });
		} else {
			this.onFunctionDefinition({ vertex });
		}
	}

	/**
	 * Dispatches {@link SemanticCfgGuidedVisitor#onUnnamedCall|onUnnamedCall} for anonymous calls, or
	 * {@link SemanticCfgGuidedVisitor#onDispatchFunctionCallOrigins|onDispatchFunctionCallOrigins} for named ones; overwrite those instead of this base-dispatch override.
	 */
	protected override visitFunctionCall(vertex: DataflowGraphVertexFunctionCall) {
		super.visitFunctionCall(vertex);
		if(vertex.origin === BuiltInProcName.Unnamed) {
			this.onUnnamedCall({ call: vertex });
		} else {
			this.onDispatchFunctionCallOrigins(vertex, vertex.origin);
		}
	}

	/**
	 * Dispatches {@link SemanticCfgGuidedVisitor#onProgram|onProgram} for the root program node.
	 * If you overwrite this, call the base implementation too so `onProgram` keeps firing.
	 */
	protected override visitUnknown(vertex: CfgStatementVertex | CfgExpressionVertex) {
		super.visitUnknown(vertex);
		const ast = this.getNormalizedAst(CfgVertex.getId(vertex));
		if(ast && RExpressionList.is(ast) && ast.info.parent === undefined) {
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
	protected onDispatchFunctionCallOrigins(call: DataflowGraphVertexFunctionCall, origins: readonly BuiltInProcName[]) {
		for(const origin of origins) {
			this.onDispatchFunctionCallOrigin(call, origin);
		}
	}

	/**
	 * This function is responsible for dispatching the appropriate event
	 * based on a given dataflow vertex. The default serves as a backend
	 * for the event functions below, each of which relates to the corresponding {@link BuiltInProcessorMapper} handler.
	 * @protected
	 * @see {@link onDispatchFunctionCallOrigins} for the aggregation in case the function call target is ambiguous.
	 */
	protected onDispatchFunctionCallOrigin(call: DataflowGraphVertexFunctionCall, origin: BuiltInProcName) {
		switch(origin) {
			case BuiltInProcName.Eval:
				return this.onEvalFunctionCall({ call });
			case BuiltInProcName.Apply:
				return this.onApplyFunctionCall({ call });
			case BuiltInProcName.ExpressionList:
				return this.onExpressionList({ call });
			case BuiltInProcName.Source:
				return this.onSourceCall({ call });
			case BuiltInProcName.Access:
				return this.onAccessCall({ call });
			case BuiltInProcName.IfThenElse: {
				// recover dead arguments from ast
				const ast = this.getNormalizedAst(call.id);
				if(!ast || !RIfThenElse.is(ast)) {
					return this.onIfThenElseCall({
						call,
						condition: call.args[0] === EmptyArgument ? undefined : call.args[0].nodeId,
						yes:       call.args[1] === EmptyArgument ? undefined : call.args[1].nodeId,
						no:        call.args[2] === EmptyArgument ? undefined : call.args[2].nodeId
					});
				} else {
					return this.onIfThenElseCall({
						call,
						condition: ast.condition.info.id,
						yes:       ast.then.info.id,
						no:        ast.otherwise?.info.id
					});
				}
			}
			case BuiltInProcName.Get:
				return this.onGetCall({ call });
			case BuiltInProcName.Rm:
				return this.onRmCall({ call });
			case BuiltInProcName.List:
				return this.onListCall({ call });
			case BuiltInProcName.Vector:
				return this.onVectorCall({ call });
			case BuiltInProcName.Assignment:
			case BuiltInProcName.SuperAssignment:
			case BuiltInProcName.AssignmentLike:
			case BuiltInProcName.TableAssignment:
				return this.onAssignmentCall({ call, ...this.getSourceAndTarget(call) });
			case BuiltInProcName.SpecialBinOp:
				if(call.args.length !== 2) {
					return this.onSpecialBinaryOpCall({ call });
				}
				return this.onSpecialBinaryOpCall({ call, lhs: call.args[0], rhs: call.args[1] });
			case BuiltInProcName.Pipe:
				if(call.args.length !== 2) {
					return this.onPipeCall({ call });
				}
				return this.onPipeCall({ call, lhs: call.args[0], rhs: call.args[1] });
			case BuiltInProcName.Quote:
				return this.onQuoteCall({ call });
			case BuiltInProcName.ForLoop:
				return this.onForLoopCall({ call, variable: call.args[0], vector: call.args[1], body: call.args[2] });
			case BuiltInProcName.RepeatLoop:
				return this.onRepeatLoopCall({ call, body: call.args[0] });
			case BuiltInProcName.WhileLoop:
				return this.onWhileLoopCall({ call, condition: call.args[0], body: call.args[1] });
			case BuiltInProcName.Replacement:
				return this.onReplacementCall({ call, ...this.getSourceAndTarget(call) });
			case BuiltInProcName.Library:
				return this.onLibraryCall({ call });
			case BuiltInProcName.Try:
				return this.onTryCall({ call });
			case BuiltInProcName.Stop:
				return this.onStopCall({ call });
			case BuiltInProcName.StopIfNot:
				return this.onStopIfNotCall({ call });
			case BuiltInProcName.RegisterHook:
				return this.onRegisterHookCall({ call });
			case BuiltInProcName.Local:
				return this.onLocalCall({ call });
			case BuiltInProcName.S3Dispatch:
				return this.onS3DispatchCall({ call });
			case BuiltInProcName.S3DispatchNext:
				return this.onS3DispatchNextCall({ call });
			case BuiltInProcName.S7NewGeneric:
				return this.onS7NewGenericCall({ call });
			case BuiltInProcName.S7Dispatch:
				return this.onS7DispatchCall({ call });
			case BuiltInProcName.Break:
				return this.onBreakCall({ call });
			case BuiltInProcName.Return:
				return this.onReturnCall({ call });
			case BuiltInProcName.Unnamed:
				return this.onUnnamedCall({ call });
			case BuiltInProcName.Recall:
				return this.onRecallCall({ call });
			case BuiltInProcName.PurrrFormula:
				return this.onPurrFormulaCall({ call });
			case BuiltInProcName.NamespaceAccess:
			case BuiltInProcName.NewEnv:
			case BuiltInProcName.StackEnv:
			case BuiltInProcName.With:
			case BuiltInProcName.Attach:
			case BuiltInProcName.Default:
			case BuiltInProcName.DefaultReadAllArgs:
			case BuiltInProcName.Function:
			case BuiltInProcName.FunctionDefinition:
			case BuiltInProcName.StringTemplate:
			case BuiltInProcName.S7MakeConstructor:
			case BuiltInProcName.ClassGenerator:
			case BuiltInProcName.ClassRelation:
			case BuiltInProcName.DefineArgument:
			case BuiltInProcName.Switch:
			case BuiltInProcName.S4Use:
				return this.onDefaultFunctionCall({ call });
			case BuiltInProcName.Load:
				return this.onLoadCall({ call });
			default:
				assertUnreachable(origin);
		}
	}

	/** Fires for the root program node being analyzed. */
	protected onProgram(_data: RExpressionList<OtherInfo>) {}

	/**
	 * A helper function to request the {@link Dataflow.origin|origins} of the given node.
	 */
	protected getOrigins(id: NodeId): Origin[] | undefined {
		return Dataflow.origin(this.config.dfg, id);
	}

	/** Fires for every `NULL` occurrence; other symbols go through {@link SemanticCfgGuidedVisitor#onSymbolConstant|onSymbolConstant} instead. */
	protected onNullConstant(_data: { vertex: DataflowGraphVertexValue, node: RSymbol<OtherInfo & ParentInformation, typeof RNull> }) {}

	/** Fires for every constant string, e.g. `"Hello World"` in `print("Hello World")`. */
	protected onStringConstant(_data: { vertex: DataflowGraphVertexValue, node: RString }) {}

	/** Fires for every constant number, e.g. `42` in `print(42)`. */
	protected onNumberConstant(_data: { vertex: DataflowGraphVertexValue, node: RNumber }) {}

	/** Fires for every constant logical, e.g. `TRUE` in `if(TRUE) { ... }`. */
	protected onLogicalConstant(_data: { vertex: DataflowGraphVertexValue, node: RLogical }) {}

	/**
	 * Fires for every constant symbol used as itself (non-standard evaluation, not resolved to a value), e.g. `foo` in `library(foo)` or `a` in `l$a`.
	 * `NULL` goes through {@link SemanticCfgGuidedVisitor#onNullConstant|onNullConstant} instead.
	 */
	protected onSymbolConstant(_data: { vertex: DataflowGraphVertexValue, node: RSymbol }) {}

	/** Fires for every variable read, e.g. `x` in `print(x)`. Use {@link getOrigins} for its origins. */
	protected onVariableUse(_data: { vertex: DataflowGraphVertexUse }) {}

	/**
	 * Fires for every variable write, e.g. `x` in `x <- 42` or `assign("x", 42)`. Use {@link getOrigins} for its origins.
	 * See {@link SemanticCfgGuidedVisitor#onAssignmentCall|onAssignmentCall} for the assignment call itself, which also carries the source.
	 */
	protected onVariableDefinition(_data: { vertex: DataflowGraphVertexVariableDefinition }) {}

	/** Fires for every anonymous function definition, e.g. `function(x) { x + 1 }` in `lapply(1:10, function(x) { x + 1 })`. */
	protected onFunctionDefinition(_data: { vertex: DataflowGraphVertexFunctionDefinition, parameters?: readonly NodeId[] }) {}

	/**
	 * Fires for every anonymous call, e.g. `(function(x) { x + 1 })(42)` or the second call in `a()()`, whose target cannot be inferred from a name
	 * (use {@link SemanticCfgGuidedVisitor#getOrigins|getOrigins}). Named calls go through {@link SemanticCfgGuidedVisitor#onDefaultFunctionCall|onDefaultFunctionCall} instead.
	 */
	protected onUnnamedCall(_data: OnCall) {}

	/**
	 * Fires for every named call not handled by a specific overload, e.g. `foo(x)` for a user-defined `foo`. flowR does not care about the dataflow
	 * impact of these (currently); use {@link SemanticCfgGuidedVisitor#getOrigins|getOrigins} to get the call's origins. Anonymous calls, which cannot
	 * be resolved via the active environment, go through {@link SemanticCfgGuidedVisitor#onUnnamedCall|onUnnamedCall} instead.
	 */
	protected onDefaultFunctionCall(_data: OnCall) {}

	/** Fires for every call to `eval`, e.g. `eval(parse(text = "x + 1"))`. */
	protected onEvalFunctionCall(_data: OnCall) {}

	/** Fires for every call to a `*apply` function, e.g. `lapply(1:10, function(x) { x + 1 })`. */
	protected onApplyFunctionCall(_data: OnCall) {}

	/**
	 * Fires for every expression list, implicit or explicit, other than the root program (see {@link SemanticCfgGuidedVisitor#onProgram|onProgram}
	 * for that) - e.g. the `{ }` block, or the implicit list `x <- x + 1` forms in `for(x in 1:10) x <- x + 1`.
	 */
	protected onExpressionList(_data: OnCall) {}

	/**
	 * Fires for every call to `source`, e.g. `source("script.R")`. Does not provide the resolved source file by default;
	 * use the {@link DataflowGraph} to ask for sourced files.
	 */
	protected onSourceCall(_data: OnCall) {}

	/** Fires for every subsetting call: `[[`, `[`, or `$`. */
	protected onAccessCall(_data: OnCall) {}

	/** Fires for every `if`-`then`-`else` call. */
	protected onIfThenElseCall(_data: OnCall & { condition: NodeId | undefined, yes: NodeId | undefined, no: NodeId | undefined }) {}

	/**
	 * Fires for every call to `get`, e.g. `get("x")`, which is used to access variables in the global environment.
	 * As flowR resolves `get` during the dataflow analysis, this may also trigger {@link SemanticCfgGuidedVisitor#onVariableUse|onVariableUse}.
	 */
	protected onGetCall(_data: OnCall) {}

	/** Fires for every call to `rm`, e.g. `rm(x)`, which removes variables from the environment. */
	protected onRmCall(_data: OnCall) {}

	/** Fires for every call that loads a library, e.g. `library(dplyr)`. */
	protected onLibraryCall(_data: OnCall) {}

	/**
	 * Fires for every assignment call, e.g. `<-` in `x <- 42`, `assign("x", 42)`, or the `data.table` assign `:=` in `DT[, x := 42]`.
	 * Replacements with a function call on the target side, like `names(x) <- 3`, go through {@link SemanticCfgGuidedVisitor#onReplacementCall|onReplacementCall} instead.
	 */
	protected onAssignmentCall(_data: OnCall & { target?: NodeId, source?: NodeId }) {}

	/** Fires for every special binary operator call, i.e. a binary call whose name starts and ends with `%`, e.g. `x %in% y`. */
	protected onSpecialBinaryOpCall(_data: OnCall & { lhs?: FunctionArgument, rhs?: FunctionArgument }) {}

	/** Fires for every call to R's pipe operator `|>`. */
	protected onPipeCall(_data: OnCall & { lhs?: FunctionArgument, rhs?: FunctionArgument }) {}

	/** Fires for every call to `quote`, e.g. `quote(x + 1)`. */
	protected onQuoteCall(_data: OnCall) {}

	/** Fires for every `for` loop, e.g. `for(i in 1:10) { print(i) }`. */
	protected onForLoopCall(_data: OnCall & { variable: FunctionArgument, vector: FunctionArgument, body: FunctionArgument }) {}

	/** Fires for every `while` loop, e.g. `while(i < 10) { i <- i + 1 }`. */
	protected onWhileLoopCall(_data: OnCall & { condition: FunctionArgument, body: FunctionArgument }) {}

	/** Fires for every `repeat` loop, e.g. `repeat { i <- i + 1; if(i >= 10) break }`. */
	protected onRepeatLoopCall(_data: OnCall & { body: FunctionArgument }) {}

	/**
	 * Fires for every call that replaces a value in a container, e.g. `names` in `names(x) <- 3` (but not for `x <- 3`).
	 * Unlike {@link SemanticCfgGuidedVisitor#onAssignmentCall|onAssignmentCall}, this does not assign a value to a variable.
	 */
	protected onReplacementCall(_data: OnCall & { source: NodeId | undefined, target: NodeId | undefined }) {}

	/** Fires for every call that (to flowR's knowledge) constructs a list, e.g. `list(1, 2, 3)`. */
	protected onListCall(_data: OnCall) {}

	/** Fires for every call that (to flowR's knowledge) constructs a vector, e.g. `c(1, 2, 3)`. */
	protected onVectorCall(_data: OnCall) {}

	/** Fires for every call to `stop`, e.g. `stop()`. */
	protected onStopCall(_data: OnCall) {}

	/** Fires for every call to `stopifnot`, e.g. `stopifnot(x > 0)`. */
	protected onStopIfNotCall(_data: OnCall) {}

	/** Fires for every call to `try`, e.g. `try(stop("error"))`, which catches possible errors. */
	protected onTryCall(_data: OnCall) {}

	/** Fires for every call that performs a local call, e.g. `local({ x <- 1; y <- 2; x + y })`. */
	protected onLocalCall(_data: OnCall) {}

	/**
	 * Fires for every call that performs an S3-like dispatch, e.g. `UseMethod("print")`.
	 * @see {@link SemanticCfgGuidedVisitor#onS3DispatchNextCall|onS3DispatchNextCall} for `NextMethod` calls.
	 */
	protected onS3DispatchCall(_data: OnCall) {}

	/**
	 * Fires for every call that performs an S3-like *next* dispatch, e.g. `NextMethod()`.
	 * @see {@link SemanticCfgGuidedVisitor#onS3DispatchCall|onS3DispatchCall} for `UseMethod` calls.
	 */
	protected onS3DispatchNextCall(_data: OnCall) {}

	/** Fires for every call that creates a new S7 generic, e.g. `new_generic`. */
	protected onS7NewGenericCall(_data: OnCall) {}

	/** Fires for every call that performs an S7 dispatch, e.g. `S7_dispatch`. */
	protected onS7DispatchCall(_data: OnCall) {}

	/** Fires for every call that registers a hook, e.g. `on.exit(print("exiting function"))`. */
	protected onRegisterHookCall(_data: OnCall) {}

	/** Fires for every `break` call, e.g. `repeat { break }`. */
	protected onBreakCall(_data: OnCall) {}

	/** Fires for every `return` call, e.g. `f <- function() { return(42) }`. */
	protected onReturnCall(_data: OnCall) {}

	/** Fires for every call to `Recall`, used to recall the function closure (usually in recursive functions). */
	protected onRecallCall(_data: OnCall) {}

	/** Fires for every purrr formula, e.g. `map(df, ~ .x + 1)`. */
	protected onPurrFormulaCall(_data: OnCall) {}

	protected getSourceAndTarget(call: DataflowGraphVertexFunctionCall): { target: NodeId | undefined, source: NodeId | undefined } {
		const outgoing = this.config.dfg.outgoingEdges(call.id);
		if(outgoing !== undefined) {
			const target = outgoing.entries().filter(([, e]) => DfEdge.includesType(e, EdgeType.Returns)).toArray();
			if(target.length === 1) {
				const targetOut = this.config.dfg.outgoingEdges(target[0][0]);
				if(targetOut !== undefined) {
					const source = targetOut.entries().filter(([t, e]) => DfEdge.includesType(e, EdgeType.DefinedBy) && t !== call.id).toArray();
					if(source.length === 1) {
						return { target: target[0][0], source: source[0][0] };
					}
				}
			}
		}
		return { target: undefined, source: undefined };
	}

	protected onLoadCall(_param: OnCall) {}
}
