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
import {AINode, AINodeStore} from './ainode'

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

export function getDfgChildrenOfType(node: NodeId, dfg: DataflowInformation, ...types: EdgeType[]): NodeId[] | undefined {
	const dfgNode: [DataflowGraphVertexInfo, OutgoingEdges] | undefined = dfg.graph.get(node)
	if(dfgNode === undefined) {
		return undefined
	}
	const [_, children] = dfgNode
	return Array.from(children.entries())
		.filter(([_, edge]) => types.some(type => edge.types.has(type)))
		.map(([id, _]) => id)
}

function getDomainOfDfgChild(node: NodeId, dfg: DataflowInformation, domainStore: AINodeStore): Domain {
	guard(dfg.graph.hasNode(node, true), `No DFG-Node found with ID ${node}`)
	const domains = getDfgChildrenOfType(node, dfg, EdgeType.Reads)
		?.map(id => domainStore.get(id)?.domain)
		.filter(domain => domain !== undefined)
		.map(domain => domain as Domain)
	return unifyDomains(domains ?? [])
}

export function runAbstractInterpretation(ast: NormalizedAst, dfg: DataflowInformation): DataflowInformation {
	const cfg = extractCFG(ast)
	const operationStack = new Stack<Handler>()
	operationStack.push(new ExprList(dfg, AINodeStore.empty())).enter()
	visitCfg(cfg, (node, _) => {
		const astNode = ast.idMap.get(node.id)
		const top = operationStack.peek()
		guard(top !== undefined, 'No operation on the stack')
		if(astNode?.type === RType.BinaryOp) {
			operationStack.push(new BinOp(dfg, AINodeStore.withParent(top.domains), astNode)).enter()
		} else if(astNode?.type === RType.IfThenElse) {
			operationStack.push(new Conditional(dfg, AINodeStore.withParent(top.domains), astNode)).enter()
		} else if(astNode?.type === RType.ExpressionList) {
			operationStack.push(new ExprList(dfg, AINodeStore.withParent(top.domains))).enter()
		} else if(astNode?.type === RType.Symbol) {
			top.next(AINodeStore.from(new AINode(getDomainOfDfgChild(node.id, dfg, top.domains), astNode)))
		} else if(astNode?.type === RType.Number) {
			top.next(AINodeStore.from(new AINode(Domain.fromScalar(astNode.content.num), astNode)))
		} else if(astNode?.type === RType.Logical) {
			top.next(AINodeStore.from(new AINode(astNode.content ? Domain.top() : Domain.bottom(), astNode)))
		} else if(node.type === CfgVertexType.EndMarker) {
			const operationResult = operationStack.pop()?.exit()
			guard(operationResult !== undefined, 'No operation result')
			const newTop = operationStack.peek()
			guard(newTop !== undefined, 'No operation on the stack')
			newTop.next(operationResult)
		} else {
			aiLogger.warn(`Unknown node type ${node.type}`)
		}
	})
	return dfg
}
