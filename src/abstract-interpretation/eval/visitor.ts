import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import type { SemanticCfgGuidedVisitorConfiguration } from '../../control-flow/semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from '../../control-flow/semantic-cfg-guided-visitor';
import { EdgeType } from '../../dataflow/graph/edge';
import { isNamedArgument, isPositionalArgument, type DataflowGraph } from '../../dataflow/graph/graph';
import type {
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexUse,
	DataflowGraphVertexValue,
} from '../../dataflow/graph/vertex';
import { OriginType } from '../../dataflow/origin/dfg-get-origin';
import type { NoInfo, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	SDValue ,
	Top,
	AbstractOperationsStringDomain,
} from './domain';
import { inspect } from 'util';
import { sdEqual } from './equality';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { ReferenceType } from '../../dataflow/environments/identifier';

function obj<T>(obj: T) {
	return inspect(obj, false, null, true);
}

export type StringDomainInfo = {
  sdvalue?: SDValue;
};

export type StringDomainVisitorConfiguration<
  OtherInfo = NoInfo,
  ControlFlow extends ControlFlowInformation = ControlFlowInformation,
  Ast extends NormalizedAst<OtherInfo & StringDomainInfo> = NormalizedAst<
    OtherInfo & StringDomainInfo
  >,
  Dfg extends DataflowGraph = DataflowGraph,
> = Omit<
  SemanticCfgGuidedVisitorConfiguration<
    OtherInfo & StringDomainInfo,
    ControlFlow,
    Ast,
    Dfg
  >,
  'defaultVisitingOrder' | 'defaultVisitingType'
>;

export class StringDomainVisitor<
  OtherInfo = NoInfo,
  ControlFlow extends ControlFlowInformation = ControlFlowInformation,
  Ast extends NormalizedAst<OtherInfo & StringDomainInfo> = NormalizedAst<
    OtherInfo & StringDomainInfo
  >,
  Dfg extends DataflowGraph = DataflowGraph,
  Config extends StringDomainVisitorConfiguration<
    OtherInfo,
    ControlFlow,
    Ast,
    Dfg
  > = StringDomainVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dfg>,
> extends SemanticCfgGuidedVisitor<
  OtherInfo & StringDomainInfo,
  ControlFlow,
  Ast,
  Dfg
> {
	domain: AbstractOperationsStringDomain;
	dirty: boolean = false;

	constructor(domain: AbstractOperationsStringDomain, config: Config) {
		super({
			...config,
			defaultVisitingOrder: 'forward',
			defaultVisitingType:  'exit',
		});
		this.domain = domain;
	}

	protected onAssignmentCall({
		call,
		target,
		source,
	}: {
    call:    DataflowGraphVertexFunctionCall;
    target?: NodeId;
    source?: NodeId;
  }): void {
		const nCall = this.getNormalizedAst(call.id);
		const nTarget = this.getNormalizedAst(target);
		const nSource = this.getNormalizedAst(source);

		if(!nTarget || !nSource || !nCall) {
			return;
		}

		if(nSource.info.sdvalue && !sdEqual(nSource.info.sdvalue, nTarget.info.sdvalue)) {
			nTarget.info.sdvalue = nSource.info.sdvalue;
			nCall.info.sdvalue = nSource.info.sdvalue;
			this.dirty = true;
			console.log('onAssignmentCall: ', obj(nCall));
		}
	}

	protected onStringConstant({
		vertex,
		node,
	}: {
    vertex: DataflowGraphVertexValue;
    node:   RString;
  }): void {
		const nVertex = this.getNormalizedAst(vertex.id);

		if(!nVertex) {
			return;
		}

		if(!nVertex.info.sdvalue) {
			nVertex.info.sdvalue = this.domain.const(node.content.str);
			this.dirty = true;
			console.log('onStringConstant: ', obj(nVertex));
		}
	}

	protected onIfThenElseCall({
		call,
		then,
		else: els,
	}: {
    call:      DataflowGraphVertexFunctionCall;
    condition: NodeId | undefined;
    then:      NodeId | undefined;
    else:      NodeId | undefined;
  }): void {
		const nCall = this.getNormalizedAst(call.id);
		const nThen = this.getNormalizedAst(then);
		const nEls = this.getNormalizedAst(els);

		if(!nCall || !nThen || !nEls) {
			return;
		}

		const returns = this.config.dfg .outgoingEdges(nCall.info.id);
		if(!returns) {
			return;
		}

		const nReturns = returns
			.entries()
			.filter(it => it[1].types & EdgeType.Returns)
			.map(it => this.getNormalizedAst(it[0]))
			.toArray();

		if(!nReturns.every(it => it !== undefined)) {
			return;
		}

		const values = nReturns.map(it => it.info.sdvalue);

		if(!values.every(it => it !== undefined)) {
			return;
		}

		if(values.length === 0) {
			return;
		}

		const value = this.domain.join(...values);
		if(!sdEqual(value, nCall.info.sdvalue)) {
			nCall.info.sdvalue = value;
			this.dirty = true;
			console.log('onIfThenElseCall: ', obj(nThen), obj(nEls));
		}
	}

	protected onExpressionList({
		call,
	}: {
    call: DataflowGraphVertexFunctionCall;
  }): void {
		const nCall = this.getNormalizedAst(call.id);

		if(!nCall) {
			return;
		}

		const nodes = nCall.children as RNode<OtherInfo & StringDomainInfo>[];
		const node = nodes.at(nodes.length - 1);
		if(!node) {
			return; 
		}
		const value = node.info.sdvalue ?? Top;

		if(!sdEqual(nCall.info.sdvalue, value)) {
			nCall.info.sdvalue = value;
			this.dirty = true;
			console.log('onExpressionList: ', obj(nCall));
		}
	}

	protected onVariableUse({ vertex }: { vertex: DataflowGraphVertexUse; }): void {
		const nVertex = this.getNormalizedAst(vertex.id);

		if(!nVertex) {
			return;
		}

		const origins = this.getOrigins(nVertex.info.id);

		if(!origins) {
			return;
		}

		const nOrigins = origins
			.filter(it => it.type === OriginType.ReadVariableOrigin)
			.map(it => this.getNormalizedAst(it.id));

		if(!nOrigins.every(it => it !== undefined)) {
			return;
		}

		const values = nOrigins.map(it => it.info.sdvalue);

		if(!values.every(it => it !== undefined)) {
			return;
		}

		const value = this.domain.join(...values);
		if(!sdEqual(nVertex.info.sdvalue, value)) {
			nVertex.info.sdvalue = value;
			this.dirty = true;
			console.log('onVariableUse: ', obj(nVertex));
		}
	}

	protected onDefaultFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall; }): void {
			if (call.name === "paste") {
				const callNode = this.getNormalizedAst(call.id);
				if(!callNode) {
					return;
				}

				const named = call.args.filter(it => isNamedArgument(it))
				const positional = call.args.filter(it => isPositionalArgument(it))

				let sepValue: SDValue;
				const sepId = named.find(it => it.name === "sep")?.nodeId;
				if (sepId) {
					const sepNode = this.getNormalizedAst(sepId)!;
					if(!sepNode) {
						return;
					}

					const valueNode = sepNode.value as RNode<OtherInfo & StringDomainInfo>;

					sepValue = valueNode.info.sdvalue ?? Top;
				} else {
					sepValue = this.domain.const(" ");
				}

				if (positional.length == 0) {
					return;
				}

				const argNodes = positional.map(arg => this.getNormalizedAst(arg.nodeId));
				if (!argNodes.every(it => it)) {
					return;
				}

				const value = this.domain.concat(sepValue, ...argNodes.map(it => it!.info.sdvalue ?? Top))
				if (!sdEqual(value, callNode.info.sdvalue)) {
					callNode.info.sdvalue = value;
					this.dirty = true;
					console.log('onDefaultFunctionCall: ', obj(callNode));
				}
			}
	}
}
