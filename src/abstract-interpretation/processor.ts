import {DataflowInformation} from '../dataflow/internal/info'
import {NodeId, NormalizedAst, ParentInformation, RNodeWithParent, RType} from '../r-bridge'
import {CfgVertexType, extractCFG} from '../util/cfg/cfg'
import {visitCfg} from '../util/cfg/visitor'
import {assertUnreachable, guard} from '../util/assert'
import {DataflowGraphVertexInfo, EdgeType, OutgoingEdges} from '../dataflow'
import {Handler} from './handler/handler'
import {BinOp} from './handler/binop/binop'
import {Conditional} from './handler/conditional/conditional'
import {Domain, unifyDomains} from './domain'
import {log} from '../util/log'

export const aiLogger = log.getSubLogger({name: 'abstract-interpretation'})

export interface AINode {
	// The ID of the node that logically holds the domain
	readonly nodeId:       NodeId
	// The ID of the whole expression that the domain was calculated from
	readonly expressionId: NodeId
	readonly domain:       Domain
	readonly astNode:      RNodeWithParent<ParentInformation>
}


export class AINodeStore extends Map<NodeId, AINode> {
	constructor(content: AINode[] | AINode | undefined = undefined) {
		if(Array.isArray(content)) {
			super(content.map(node => [node.nodeId, node]))
		} else if(content !== undefined) {
			super([[content.nodeId, content]])
		} else if(content === undefined) {
			super()
		} else {
			assertUnreachable(content)
		}
	}

	push(node: AINode): void {
		this.set(node.nodeId, node)
	}
}

export function mergeDomainStores(...stores: AINodeStore[]): AINodeStore {
	const result = new AINodeStore()
	for(const store of stores) {
		for(const [id, node] of store) {
			if(result.has(id)) {
				const existing = result.get(id)
				guard(existing !== undefined, `Domain for ID ${id} is missing`)
				const unified = unifyDomains([existing.domain, node.domain])
				result.set(id, {...node, domain: unified})
			} else {
				result.set(id, node)
			}
		}
	}
	return result
}

class Stack<ElementType> {
	private backingStore: ElementType[] = []

	size(): number { return this.backingStore.length }
	peek(): ElementType | undefined { return this.backingStore[this.size() - 1] }
	pop(): ElementType | undefined { return this.backingStore.pop() }
	push(item: ElementType): ElementType {
		this.backingStore.push(item)
		return item
	}
}

function getDomainOfDfgChild(node: NodeId, dfg: DataflowInformation, domainStore: AINodeStore): Domain {
	const dfgNode: [DataflowGraphVertexInfo, OutgoingEdges] | undefined = dfg.graph.get(node)
	guard(dfgNode !== undefined, `No DFG-Node found with ID ${node}`)
	const [_, children] = dfgNode
	const ids = Array.from(children.entries())
		.filter(([_, edge]) => edge.types.has(EdgeType.Reads))
		.map(([id, _]) => id)
	const domains: Domain[] = []
	for(const id of ids) {
		const domain = domainStore.get(id)?.domain
		guard(domain !== undefined, `No domain found for ID ${id}`)
		domains.push(domain)
	}
	return unifyDomains(domains)
}

export function runAbstractInterpretation(ast: NormalizedAst, dfg: DataflowInformation): DataflowInformation {
	const cfg = extractCFG(ast)
	const operationStack = new Stack<Handler>()
	let domainStore = new AINodeStore()
	visitCfg(cfg, (node, _) => {
		const astNode = ast.idMap.get(node.id)
		if(astNode?.type === RType.BinaryOp) {
			operationStack.push(new BinOp(astNode)).enter()
		} else if(astNode?.type === RType.IfThenElse) {
			operationStack.push(new Conditional(astNode)).enter()
		} else if(astNode?.type === RType.Symbol) {
			operationStack.peek()?.next(new AINodeStore({
				nodeId:       astNode.info.id,
				expressionId: astNode.info.id,
				domain:       getDomainOfDfgChild(node.id, dfg, domainStore),
				astNode:      astNode,
			}))
		} else if(astNode?.type === RType.Number){
			const num = astNode.content.num
			operationStack.peek()?.next(new AINodeStore({
				nodeId:       astNode.info.id,
				expressionId: astNode.info.id,
				domain:       Domain.fromScalar(num),
				astNode:      astNode,
			}))
		} else if(node.type === CfgVertexType.EndMarker) {
			const operation = operationStack.pop()
			if(operation === undefined) {
				return
			}
			const operationResult = operation.exit()
			domainStore = mergeDomainStores(domainStore, operationResult)
			operationStack.peek()?.next(operationResult)
		} else {
			aiLogger.warn(`Unknown node type ${node.type}`)
		}
	})
	return dfg
}
