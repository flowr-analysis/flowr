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
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	SDValue ,
	Top,
	AbstractOperationsStringDomain,
} from './domain';
import { inspect } from 'util';
import { sdEqual } from './equality';
import { unescapeSpecialChars } from '../data-frame/resolve-args';

function obj<T>(obj: T) {
	return inspect(obj, false, null, true);
}

function resolveNodeToString(node: RNode<StringDomainInfo & ParentInformation> | undefined): SDValue {
	if (node === undefined) return Top;
	if (node.info.sdvalue === undefined) return Top;
	console.log(`${node.type}(${node.lexeme}) resolved ${obj(node.info.sdvalue)}`)
	return node.info.sdvalue;
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

	resolveIdToString(id: NodeId | undefined): SDValue {
		if (id === undefined) return Top;
		const node = this.getNormalizedAst(id);
		return resolveNodeToString(node);
	}

	updateNodeValue(node: RNode<StringDomainInfo & ParentInformation> | undefined, calculation: (node: RNode<StringDomainInfo & ParentInformation>) => SDValue) {
		if (node === undefined) return;
		const newValue = calculation(node)
		const oldValue = node.info.sdvalue;
		if (!sdEqual(newValue, oldValue)) {
			this.dirty = true;
			node.info.sdvalue = newValue;
			console.log(`${node.type}(${node.lexeme}) assigned ${obj(newValue)}`)
		}
	}

	updateIdValue(id: NodeId | undefined, calculation: (node: RNode<StringDomainInfo & ParentInformation>) => SDValue) {
		if (id === undefined) return;
		const node = this.getNormalizedAst(id);
		this.updateNodeValue(node, calculation)
	}

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
		this.updateIdValue(target, () => this.resolveIdToString(source));
		this.updateIdValue(call.id, () => this.resolveIdToString(source));
	}

	protected onStringConstant({
		vertex,
		node,
	}: {
    vertex: DataflowGraphVertexValue;
    node:   RString;
  }): void {
	  this.updateIdValue(vertex.id, () => this.domain.const(unescapeSpecialChars(node.content.str)));
	}

	protected onIfThenElseCall({
		call,
	}: {
    call:      DataflowGraphVertexFunctionCall;
    condition: NodeId | undefined;
    then:      NodeId | undefined;
    else:      NodeId | undefined;
  }): void {
  	this.updateIdValue(call.id, () => {
			const returns = this.config.dfg.outgoingEdges(call.id);
			if (!returns) return Top;
  		const values = returns
  			.entries()
  			.filter(it => it[1].types & EdgeType.Returns)
  			.map(it => this.resolveIdToString(it[0]))
  			.toArray();

  		if (values.length === 0) return Top;
			return this.domain.join(...values);
  	});  
	}

	protected onExpressionList({
		call,
	}: {
    call: DataflowGraphVertexFunctionCall;
  }): void {
	  this.updateIdValue(call.id, (node) => {
	  	const children = node.children as RNode<StringDomainInfo & ParentInformation>[]
	  	const last = children.at(children.length - 1);
	  	if (!last) return Top;
	  	return resolveNodeToString(last)
	  });
	}

	protected onVariableUse({ vertex }: { vertex: DataflowGraphVertexUse; }): void {
		this.updateIdValue(vertex.id, () => {
			const origins = this.getOrigins(vertex.id);
			if (!origins) return Top;
			const values = origins
				.filter(it => it.type === OriginType.ReadVariableOrigin)
				.map(it => this.resolveIdToString(it.id))
			return this.domain.join(...values)
		});
	}

	protected onDefaultFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall; }): void {
		switch (call.name) {
			case "paste":
				this.updateIdValue(call.id, () => {
					const named = call.args.filter(it => isNamedArgument(it))
					const positional = call.args.filter(it => isPositionalArgument(it))

					const sepId = named.find(it => it.name === "sep")?.nodeId;
					const sepValue = (sepId !== undefined) ? (this.getNormalizedAst(sepId)?.value as RNode<StringDomainInfo & ParentInformation> | undefined) : undefined;
					const sep = (sepValue !== undefined) ? resolveNodeToString(sepValue) : this.domain.const(" ");

					if (positional.length == 0) return Top;

					const values = positional.map(it => this.resolveIdToString(it.nodeId))
					return this.domain.concat(sep, ...values)
				});
				break;

			case "paste0":
				this.updateIdValue(call.id, () => {
					const positional = call.args.filter(it => isPositionalArgument(it))
					const sep = this.domain.const("");

					if (positional.length == 0) return Top;

					const values = positional.map(it => this.resolveIdToString(it.nodeId))
					return this.domain.concat(sep, ...values)
				});
				break;
		}
	}
}
