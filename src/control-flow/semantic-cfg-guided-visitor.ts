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
 * The general semantic visitor can not decide on how to combine these cases,
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
	 * Get the normalized AST node for the given id or fail if it does not exist.
	 */
	protected getNormalizedAst(id: NodeId): RNode<OtherInfo & ParentInformation> | undefined {
		return this.config.normalizedAst.idMap.get(id);
	}

	protected override visitValue(val: DataflowGraphVertexValue) {
		super.visitValue(val);
		const astVertex = this.getNormalizedAst(val.id);
		if(!astVertex) {
			return;
		}
		switch(astVertex.type) {
			case RType.String:  return this.onStringConstant(val, astVertex);
			case RType.Number:  return this.onNumberConstant(val, astVertex);
			case RType.Logical: return this.onLogicalConstant(val, astVertex);
		}
		guard(false, `Unexpected value type ${astVertex.type} for value ${astVertex.lexeme}`);
	}

	protected override visitVariableUse(val: DataflowGraphVertexUse) {
		super.visitVariableUse(val);
		this.onVariableUse(val);
	}

	protected override visitVariableDefinition(val: DataflowGraphVertexVariableDefinition) {
		super.visitVariableDefinition(val);
		this.onVariableDefinition(val);
	}

	protected override visitFunctionDefinition(def: DataflowGraphVertexFunctionDefinition): void {
		super.visitFunctionDefinition(def);
		this.onFunctionDefinition(def);
	}

	protected override visitFunctionCall(call: DataflowGraphVertexFunctionCall) {
		super.visitFunctionCall(call);
		if(call.origin === 'unnamed') {
			this.onUnnamedCall(call);
		} else {
			this.onDispatchFunctionCallOrigins(call, call.origin);
		}
	}

	protected onDispatchFunctionCallOrigins(call: DataflowGraphVertexFunctionCall, origins: readonly string[]) {
		for(const origin of origins) {
			this.onDispatchFunctionCallOrigin(call, origin);
		}
	}

	protected onDispatchFunctionCallOrigin(call: DataflowGraphVertexFunctionCall, origin: string) {
		switch(origin) {
			case 'builtin:eval':
				return this.onEvalFunctionCall({ call });
			case 'builtin:apply':
				return this.onApplyFunctionCall({ call });
			case 'builtin:expressionList':
				return this.onExpressionList({ call });
			case 'builtin:source':
				return this.onSourceCall({ call });
			case 'builtin:access':
				return this.onAccessCall({ call });
			case 'builtin:ifThenElse':
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
			case 'builtin:specialBinaryOp':
				return this.onSpecialBinaryOpCall({ call });
			case 'builtin:pipe':
				return this.onPipeCall({ call });
			case 'builtin:quote':
				return this.onQuoteCall({ call });
			case 'builtin:forLoop':
				return this.onForLoopCall({ call, variable: call.args[0], vector: call.args[1], body: call.args[2] });
			case 'builtin:repeatLoop':
				return this.onRepeatLoopCall({ call, body: call.args[0] });
			case 'builtin:whileLoop':
				return this.onWhileLoopCall({ call, condition: call.args[0], body: call.args[1] });
			case 'builtin:replacement':
				return this.onReplacementCall({ call });
			case 'builtin:library':
				return this.onLibraryCall({ call });
			default:
			case 'builtin:default':
				return this.onDefaultFunctionCall({ call });
		}
	}


	/**
	 * Requests the {@link getOriginInDfg|origins} of the given node.
	 */
	protected getOrigins(id: NodeId): Origin[] | undefined {
		return getOriginInDfg(this.config.dataflow.graph, id);
	}

	/** Called for every constant string value in the program */
	protected onStringConstant(_vertex: DataflowGraphVertexValue, _node: RString) {}

	/** Called for every constant number value in the program */
	protected onNumberConstant(_vertex: DataflowGraphVertexValue, _node: RNumber) {}

	/** Called for every constant logical value in the program */
	protected onLogicalConstant(_vertex: DataflowGraphVertexValue, _node: RLogical) {}

	/**
	 * Called for every variable that is read within the program.
	 * You can use {@link getOrigins} to get the origins of the variable.
	 */
	protected onVariableUse(_vertex: DataflowGraphVertexUse) {}

	/**
	 * Called for every variable that is written within the program.
	 * You can use {@link getOrigins} to get the origins of the variable.
	 */
	protected onVariableDefinition(_vertex: DataflowGraphVertexVariableDefinition) {}

	/** Called for every anonymous function definition */
	protected onFunctionDefinition(_vertex: DataflowGraphVertexFunctionDefinition) {}

	protected onUnnamedCall(_call: DataflowGraphVertexFunctionCall) {}

	protected onDefaultFunctionCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onEvalFunctionCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

	protected onApplyFunctionCall(_data: { call: DataflowGraphVertexFunctionCall }) {
	}

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