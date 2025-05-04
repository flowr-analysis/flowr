import type { ControlFlowInformation } from './control-flow-graph';

import type { DataflowInformation } from '../dataflow/info';


import type { DataflowCfgGuidedVisitorConfiguration } from './dfg-cfg-guided-visitor';
import { DataflowAwareCfgGuidedVisitor } from './dfg-cfg-guided-visitor';
import type { NormalizedAst, RNodeWithParent } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SyntaxCfgGuidedVisitorConfiguration } from './syntax-cfg-guided-visitor';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RNumberValue, RStringValue } from '../r-bridge/lang-4.x/convert-values';
import type { RLogicalValue } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { Origin } from '../dataflow/origin/dfg-get-origin';
import { getOriginInDfg } from '../dataflow/origin/dfg-get-origin';

export interface SemanticCfgGuidedVisitorConfiguration<
	Cfg extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst          = NormalizedAst,
	Dfg extends DataflowInformation    = DataflowInformation
> extends DataflowCfgGuidedVisitorConfiguration<Cfg, Dfg>, SyntaxCfgGuidedVisitorConfiguration<Cfg, Ast> {
}

/**
 * This visitor extends on the {@link DataflowAwareCfgGuidedVisitor} by dispatching visitors for separate function calls as well,
 * providing more information!
 * In a way, this is the mixin of syntactic and dataflow guided visitation.
 *
 * Use {@link BasicCfgGuidedVisitor#start} to start the traversal.
 */
export class SemanticCfgGuidedVisitor<
    Cfg extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst          = NormalizedAst,
	Dfg extends DataflowInformation    = DataflowInformation,
	Config extends SemanticCfgGuidedVisitorConfiguration<Cfg, Ast, Dfg> = SemanticCfgGuidedVisitorConfiguration<Cfg, Ast, Dfg>
> extends DataflowAwareCfgGuidedVisitor<Cfg, Dfg, Config> {

	/**
	 * Get the normalized AST node for the given id or fail if it does not exist.
	 */
	protected getNormalizedAst(id: NodeId): RNodeWithParent | undefined {
		return this.config.normalizedAst.idMap.get(id);
	}

	/**
	 * Requests the {@link getOriginInDfg|origins} of the given node.
	 */
	protected getOrigins(id: NodeId): Origin[] | undefined {
		return getOriginInDfg(this.config.dataflow.graph, id);
	}

	/**
 	 * Called for every constant value in the program
	 */
	protected onConstant(_id: NodeId, _value: RNumberValue | RStringValue | RLogicalValue) {
	}

	/**
	 * Called for every variable that is read within the program.
	 * You can use {@link getOrigins} to get the origins of the variable.
	 */
	protected onVariableUse(_id: NodeId, _name: string) {
	}

	/**
	 * Called for every variable that is written within the program.
	 * You can use {@link getOrigins} to get the origins of the variable.
	 */
	protected onVariableDefinition(_id: NodeId, _name: string, _source: NodeId, _arguments: readonly NodeId[]) {
	}

	/**
	 * Called for every anonymous function definition
	 */
	protected onFunctionDefinition(_id: NodeId, _params: readonly NodeId[], _body: NodeId) {
	}

	// TODO: config
	protected onDefaultFunctionCall(_id: NodeId, _name: string, _args: readonly NodeId[]) {
	}

	protected onEvalFunctionCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onApplyFunctionCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onExpressionList(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onSourceCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onAccessCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onIfThenElseCall(_id: NodeId, _condition: NodeId, _then: NodeId, _else: NodeId) {
	}

	protected onGetCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onRmCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	// TODO: improve on function arguments
	protected onLibraryCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onAssignmentCall(_id: NodeId, _args: readonly NodeId[]) {
		// TODO: table assignment
	}

	protected onSpecialBinaryOpCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onPipeCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onQuoteCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onForLoopCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onRepeatLoopCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onWhileLoopCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onReplacementCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onListCall(_id: NodeId, _args: readonly NodeId[]) {
	}

	protected onVectorCall(_id: NodeId, _args: readonly NodeId[]) {
	}
}