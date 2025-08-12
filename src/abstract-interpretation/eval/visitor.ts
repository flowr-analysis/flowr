import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import type { SemanticCfgGuidedVisitorConfiguration } from '../../control-flow/semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from '../../control-flow/semantic-cfg-guided-visitor';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexValue } from '../../dataflow/graph/vertex';
import type { NoInfo } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AbstractStringValue, StringDomain } from './domain';

export type StringDomainInfo = {
  stringdomain?: {
    value: AbstractStringValue
  }
}

export type StringDomainVisitorConfiguration<
	OtherInfo = NoInfo,
  ControlFlow extends ControlFlowInformation               = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo & StringDomainInfo>  = NormalizedAst<OtherInfo & StringDomainInfo>,
	Dfg extends DataflowGraph                                = DataflowGraph,
> = Omit<SemanticCfgGuidedVisitorConfiguration<OtherInfo & StringDomainInfo, ControlFlow, Ast, Dfg>, 'defaultVisitingOrder' | 'defaultVisitingType'>;

export class StringDomainVisitor<
	OtherInfo = NoInfo,
  ControlFlow extends ControlFlowInformation               = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo & StringDomainInfo>  = NormalizedAst<OtherInfo & StringDomainInfo>,
	Dfg extends DataflowGraph                                = DataflowGraph,
	Config extends StringDomainVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dfg> = StringDomainVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dfg>
> extends SemanticCfgGuidedVisitor<OtherInfo & StringDomainInfo, ControlFlow, Ast, Dfg> {
	domain: StringDomain;
  
	constructor(domain: StringDomain, config: Config) {
		super({ ...config, defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' });
		this.domain = domain;
	}

	protected onAssignmentCall({ call, target, source }: { call: DataflowGraphVertexFunctionCall; target?: NodeId; source?: NodeId; }): void {
		const nCall = this.getNormalizedAst(call.id);
		const nTarget = this.getNormalizedAst(target);
		const nSource = this.getNormalizedAst(source);

		if(!nTarget || !nSource || !nCall) {
			return;
		}

		console.log('onAssignmentCall: ', nTarget, ' <- ', nSource);

		const value = this.domain.assignment(nSource);
		nCall.info.stringdomain = { value };
		nTarget.info.stringdomain = { value };
	}

	protected onStringConstant({ vertex, node }: { vertex: DataflowGraphVertexValue; node: RString; }): void {
		const nVertex = this.getNormalizedAst(vertex.id);

		if(!nVertex) {
			return;
		}
    
		console.log('onStringConstant: ', nVertex);

		const value = this.domain.stringConstant(nVertex, node);
		nVertex.info.stringdomain = { value };
	}
}
