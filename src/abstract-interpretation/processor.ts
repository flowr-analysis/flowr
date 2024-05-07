import {DataflowInformation} from '../dataflow/internal/info'
import {NodeId, NormalizedAst, RType} from '../r-bridge'
import {CfgVertexType, extractCFG} from '../util/cfg/cfg'
import {visitCfg} from '../util/cfg/visitor'
import {guard} from '../util/assert'
import {DataflowGraphVertexInfo, EdgeType, OutgoingEdges} from '../dataflow'
import {Handler} from './handler/handler'
import {BinOp} from './handler/binop/binop'
import {Conditional} from './handler/conditional/conditional'
import {Domain, unifyDomains} from './domain'
import {log} from '../util/log'
import {ExprList} from './handler/exprlist/exprlist'
import {AINodeStore, mergeDomainStores} from './ainode'

export const aiLogger = log.getSubLogger({name: 'abstract-interpretation'})

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
			operationStack.push(new BinOp(dfg, astNode)).enter()
		} else if(astNode?.type === RType.IfThenElse) {
			operationStack.push(new Conditional(dfg, astNode)).enter()
		} else if(astNode?.type === RType.ExpressionList) {
			operationStack.push(new ExprList(dfg)).enter()
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
