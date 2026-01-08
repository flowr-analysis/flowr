import { VariableResolve } from '../../config';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import type { SemanticCfgGuidedVisitorConfiguration } from '../../control-flow/semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from '../../control-flow/semantic-cfg-guided-visitor';
import { resolveIdToValue } from '../../dataflow/eval/resolve/alias-tracking';
import { EdgeType } from '../../dataflow/graph/edge';
import { isNamedArgument, isPositionalArgument, type DataflowGraph } from '../../dataflow/graph/graph';
import type {
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexUse,
	DataflowGraphVertexValue,
} from '../../dataflow/graph/vertex';
import { BuiltInFunctionOrigin, OriginType } from '../../dataflow/origin/dfg-get-origin';
import type { NoInfo, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { unescapeSpecialChars } from '../data-frame/resolve-args';
import { Graph, ImplicitConversionNode, Node, UnknownNode, type NodeId } from './graph';
import { valueSetGuard } from '../../dataflow/eval/values/general';
import { isValue } from '../../dataflow/eval/values/r-value';
import { Top } from './domain';

const sprintf = require('sprintf-js').sprintf;

type StringDomainVisitorConfiguration<
  OtherInfo = NoInfo,
  ControlFlow extends ControlFlowInformation = ControlFlowInformation,
  Ast extends NormalizedAst<OtherInfo> = NormalizedAst<OtherInfo>,
  Dfg extends DataflowGraph = DataflowGraph,
> = Omit<
  SemanticCfgGuidedVisitorConfiguration<
    OtherInfo,
    ControlFlow,
    Ast,
    Dfg
  >,
  'defaultVisitingOrder' | 'defaultVisitingType'
>

export class StringDomainVisitor<
  OtherInfo = NoInfo,
  ControlFlow extends ControlFlowInformation = ControlFlowInformation,
  Ast extends NormalizedAst<OtherInfo> = NormalizedAst<OtherInfo>,
  Dfg extends DataflowGraph = DataflowGraph,
  Config extends StringDomainVisitorConfiguration<
    OtherInfo,
    ControlFlow,
    Ast,
    Dfg
  > = StringDomainVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dfg>,
> extends SemanticCfgGuidedVisitor<
  OtherInfo,
  ControlFlow,
  Ast,
  Dfg
> {
	graph = new Graph()

	constructor(config: Config) {
		super({
			...config,
			defaultVisitingOrder: 'backward',
			defaultVisitingType:  'exit',
		});
	}

	protected onStringConstant({
		vertex,
		node,
	}: {
    vertex: DataflowGraphVertexValue;
    node:   RString;
  }): void {
  	this.graph.insertNode(vertex.id, {
  		type: "const",
  		value: unescapeSpecialChars(node.content.str)
  	})
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
  	if (source !== undefined && target !== undefined) {
  		this.graph.insertNode(target, { type: "alias", to: source})
  		this.graph.insertNode(call.id, { type: "alias", to: source})
  	}
	}

	protected onIfThenElseCall({
		call,
		condition,
	}: {
    call:      DataflowGraphVertexFunctionCall;
    condition?: NodeId;
    then?:      NodeId;
    else?:      NodeId;
  }): void {
		const returns = this.config.dfg.outgoingEdges(call.id);
		if (!returns) {
			this.graph.insertNode(call.id, { type: "unknown" })
			return
		};

		const values = returns
			.entries()
			.filter(it => it[1].types & EdgeType.Returns)
			.map(it => it[0])
			.toArray();

  	const conditionValue = resolveIdToValue(condition, {
  		environment: call.environment,
	  	graph: this.config.dfg,
	  	idMap: this.config.normalizedAst.idMap,
	  	full: true,
	  	resolve: VariableResolve.Alias,
	  })
		const conditionIsAlwaysFalse = valueSetGuard(conditionValue)?.elements.every(d => d.type === 'logical' && d.value === false) ?? false;
		const conditionIsAlwaysTrue = valueSetGuard(conditionValue)?.elements.every(d => d.type === 'logical' && d.value === true) ?? false;

		if (!(conditionIsAlwaysTrue || conditionIsAlwaysFalse) && values.length < 2) {
			this.graph.insertNode(call.id, { type: "unknown" })
			return
		};

		let node: Node
		if (values.length === 0) {
			node = { type: "unknown" }
		} else if (values.length === 1) {
			node = { type: "alias", to: values[0] }
		} else {
			node = { type:"join", params: values }
		}
		this.graph.insertNode(call.id, node)
	}

	protected onExpressionList({
		call,
	}: {
    call: DataflowGraphVertexFunctionCall;
  }): void {
		const astNode = this.getNormalizedAst(call.id);
  	const children = astNode?.children as RNode<ParentInformation>[] | undefined ?? [];
  	const last = children.at(children.length - 1);

  	let node: Node
  	if (last !== undefined) {
  		node = { type: "alias", to: last.info.id }
  	} else {
  		node = { type: "unknown" }
  	}
		this.graph.insertNode(call.id, node)
	}

	protected onVariableUse({ vertex }: { vertex: DataflowGraphVertexUse; }): void {
		const node = this.getNormalizedAst(vertex.id)!
		const nodeValue = node.value as RNode<ParentInformation> | undefined
		const origins = this.getOrigins(vertex.id) ?? (nodeValue !== undefined ? this.getOrigins(nodeValue.info.id) : undefined);

		let retNode: Node
		if (origins === undefined || origins.length === 0) {
			retNode = { type: "unknown" }
		} else if (origins.length === 1) {
			retNode = { type: "alias", to: origins[0].id }
		} else {
			retNode = { type:"join", params: origins.map(it => it.id) }
		}
		this.graph.insertNode(vertex.id, retNode)
	}

	protected onDefaultFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall; }): void {
		const builtinOrigin = this.getOrigins(call.id)?.find(it => it.type == OriginType.BuiltInFunctionOrigin) 
		if (builtinOrigin) {
			this.onBuiltinFunctionCall({builtin: builtinOrigin, call});
		} else {
			switch (call.name) {
				case "toupper":
				case "tolower": {
					const positional = call.args.filter(it => isPositionalArgument(it))

					let node: Node
					if (positional.length != 1) {
						node = { type: "unknown" }
					} else {
						let value: NodeId = positional[0].nodeId

						const resolvedValue = this.resolveIdToImplicitNode(value)
						if (resolvedValue !== undefined) {
							value = this.graph.insertNode(`${value}-converted`, resolvedValue)
						}

						node = { type: "casing", to: call.name === "toupper" ? "upper" : "lower", value: positional[0].nodeId }
					}
					this.graph.insertNode(call.id, node)
					break;
				}

				case "sprintf": {
					const named: readonly [string, NodeId][] = call.args.filter(it => isNamedArgument(it)).map(it => [it.name, it.nodeId])
					const positional = call.args
						.filter(it => isPositionalArgument(it))
						.map(it => {
							const resolvedValue = this.resolveIdToImplicitNode(it.nodeId)
							if (resolvedValue !== undefined) {
								return this.graph.insertNode(`${it.nodeId}-converted`, resolvedValue)
							} else {
								return it.nodeId
							}
						})
					
					this.graph.insertNode(call.id, {
						type: "function",
						name: call.name,
						positional,
						named
					})

					break
				}

				default: {
					const named: readonly [string, NodeId][] = call.args.filter(it => isNamedArgument(it)).map(it => [it.name, it.nodeId])
					const positional = call.args.filter(it => isPositionalArgument(it)).map(it => it.nodeId)
					
					this.graph.insertNode(call.id, {
						type: "function",
						name: call.name,
						positional,
						named
					})

					break
				}
			}
		}
	}

	private onBuiltinFunctionCall({ builtin, call }: { builtin: BuiltInFunctionOrigin, call: DataflowGraphVertexFunctionCall}): void {
		switch (builtin.fn.name) {
			case "paste0":
			case "paste": {
				const named = call.args.filter(it => isNamedArgument(it))
				const positional = call.args.filter(it => isPositionalArgument(it))

				if (positional.length === 0) {
					this.graph.insertNode(call.id, { type: "unknown" })
					break
				}

				let separator: NodeId
				if (builtin.fn.name === "paste") {
					const sepId = named.find(it => it.name === "sep")?.nodeId
					if (sepId !== undefined) {
						const valId = (this.getNormalizedAst(sepId)?.value as RNode<ParentInformation> | undefined)?.info.id
						if (valId !== undefined) {
							const origins = this.getOrigins(valId)
								?.filter(it => it.type === OriginType.ConstantOrigin || it.type === OriginType.ReadVariableOrigin)
								.map(it => it.id);

							if (!origins || origins.length !== 1) separator = this.graph.insertIfMissing(sepId, { type: "unknown" })
							else separator = this.graph.insertNode(sepId, { type: "alias", to: origins[0] })
						} else {
							separator = this.graph.insertIfMissing("sdconst-unknown", { type: "unknown" })
						}
					} else {
						separator = this.graph.insertIfMissing("sdconst-space", { type: "const", value: " " })
					}
				} else if (builtin.fn.name === "paste0") {
					separator = this.graph.insertIfMissing("sdconst-blank", { type: "const", value: "" })
				} else {
					throw "unreachable"
				}

				let node: Node = {
					type: "concat",
					separator,
					params: positional.map(it => {
						const value = this.resolveIdToImplicitNode(it.nodeId)
						if (value !== undefined) {
							return this.graph.insertNode(`${it.nodeId}-converted`, value)
						} else {
							return it.nodeId
						}
					})
				}
				this.graph.insertNode(call.id, node)
				break
			}
		}
	}

	private resolveIdToImplicitNode(nodeId: NodeId): ImplicitConversionNode | UnknownNode | undefined {
		const value = resolveIdToValue(nodeId, {
			idMap: this.config.normalizedAst.idMap,
			resolve: VariableResolve.Alias,
			graph: this.config.dfg,
			full: true,
		})

		if (isValue(value)) {
			const allTypesSupported = value.elements.every(it => isValue(it) && (it.type === "logical" || it.type === "number" || it.type === "interval"))
			if (allTypesSupported) {
				const values = value.elements.filter(it => isValue(it)).flatMap((it): (string | Top)[] => {
					if (it.type === "logical") {
						if (!isValue(it.value)) {
							return [Top]
						} else if (it.value === true) {
							return ["TRUE"]
						} else if (it.value === false) {
							return ["FALSE"]
						} else if (it.value === "maybe") {
							return ["TRUE", "FALSE"]
						} else {
							return [Top]
						}
					} else if (it.type === "number") {
						if (!isValue(it.value) || it.value.complexNumber) {
							return [Top]
						} else {
							return [sprintf("%.15g", it.value.num)]
						}
					} else if (it.type === "interval") {
						if (
							isValue(it.start.value) &&
							isValue(it.end.value) &&
							it.startInclusive === true &&
							it.endInclusive === true &&
							it.start.value.complexNumber === false &&
							it.end.value.complexNumber === false &&
						  it.start.value.num === it.end.value.num
						) {
							return [sprintf("%.15g", it.start.value.num)]
						} else {
							return [Top]
						}
					} else {
						return [Top]
					}
				})

				if (values.every(it => typeof(it) === "string" )) {
					return { type: "implicit-conversion", value: values, of: nodeId }
				} else {
					return { type: "unknown" }
				}
			} else {
				return undefined
			}
		} else {
			return undefined
		}
	}
}
