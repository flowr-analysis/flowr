import {DataflowInformation} from '../dataflow/internal/info'
import {NodeId, NormalizedAst, ParentInformation, RAssignmentOp, RBinaryOp, RType} from '../r-bridge'
import {CfgVertexType, extractCFG} from '../util/cfg/cfg'
import {visitCfg} from '../util/cfg/visitor'
import {guard} from '../util/assert'
import {DataflowGraphVertexInfo, EdgeType, OutgoingEdges} from '../dataflow'

const constraintMap = new Map<NodeId, Constraints>()

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

interface IHandler<ValueType> {
	name:  string,
	enter: () => void
	exit:  () => ValueType
	next:  (value: ValueType) => void
}

interface Interval {
	min:          number,
	max:          number,
	minInclusive: boolean,
	maxInclusive: boolean
}

type Domain = Set<Interval>

interface Constraints {
	node:     NodeId,
	domain:   Domain,
	debugMsg: string
}

function compareIntervals(interval1: Interval, interval2: Interval): number {
	const diff = interval1.min - interval2.min
	if(diff !== 0) {
		return diff
	}
	return Number(!interval1.minInclusive) - Number(!interval2.minInclusive)
}

function unifyDomains(domains: Domain[]): Domain {
	const allIntervals = new Array<Interval>()
	domains.forEach(domain => allIntervals.push(...domain))
	allIntervals.sort(compareIntervals)
	if(!allIntervals.length) {
		return new Set<Interval>()
	}

	const resultingDomain = new Set<Interval>()
	let currentInterval = allIntervals[0]
	allIntervals.forEach(interval => {
		if(interval.min < currentInterval.max) {
			if(interval.max > currentInterval.max) {
				currentInterval.max = interval.max
				currentInterval.maxInclusive = interval.maxInclusive
			}
		} else {
			resultingDomain.add(currentInterval)
			currentInterval = interval
		}
	})
	resultingDomain.add(currentInterval)
	return resultingDomain
}

function domainFromScalar(n: number): Domain {
	return new Set([{min: n, minInclusive: true, max: n, maxInclusive: true}])
}

function getDomainOfDfgChild(node: NodeId, dfg: DataflowInformation): Domain {
	const dfgNode: [DataflowGraphVertexInfo, OutgoingEdges] | undefined = dfg.graph.get(node)
	guard(dfgNode !== undefined, `No DFG-Node found with ID ${node}`)
	const [_, children] = dfgNode
	const ids = Array.from(children.entries())
		.filter(([_, edge]) => edge.types.has(EdgeType.Reads))
		.map(([id, _]) => id)
	const domains = new Array<Domain>()
	for(const id of ids) {
		const constraint = constraintMap.get(id)
		guard(constraint !== undefined, `No constraint found for ID ${id}`)
		domains.push(constraint.domain)
	}
	return unifyDomains(domains)
}

class Assignment implements IHandler<Constraints> {
	private lhs:           NodeId | undefined
	private rhs:           NodeId | undefined
	private readonly node: RAssignmentOp<ParentInformation>
	name = 'Assignment'

	constructor(node: RAssignmentOp<ParentInformation>) {
		this.node = node
	}

	enter(): void {
		console.log(`Entered ${this.name} ${this.node.info.id}`)
	}

	exit(): Constraints {
		console.log(`Exited ${this.name} ${this.node.info.id}`)
		return {
			node:     this.lhs as NodeId,
			domain:   new Set(), // TODO: check interval of the assignments source
			debugMsg: this.name
		}
	}

	next(constraint: Constraints): void {
		if(this.lhs === undefined) {
			this.lhs = constraint.node
		} else if(this.rhs === undefined){
			this.rhs = constraint.node
		}
		console.log(`${this.name} received ${constraint.debugMsg}`)
	}
}

class BinOp implements IHandler<Constraints> {
	private readonly node: RBinaryOp<ParentInformation>

	constructor(node: RBinaryOp<ParentInformation>) {
		this.node = node
	}

	name = 'Bin Op'

	enter(): void {
		console.log(`Entered ${this.name}`)
	}

	exit(): Constraints {
		console.log(`Exited ${this.name}`)
		return {
			node:     this.node.info.id,
			domain:   new Set(), // TODO: Check the operands constraints and see how the operation affects those
			debugMsg: this.name
		}
	}

	next(value: Constraints): void {
		console.log(`${this.name} received ${value.debugMsg}`)
	}
}

export function runAbstractInterpretation(ast: NormalizedAst, dfg: DataflowInformation): DataflowInformation {
	const cfg = extractCFG(ast)
	const operationStack = new Stack<IHandler<Constraints>>()
	visitCfg(cfg, (node, _) => {
		const astNode = ast.idMap.get(node.id)
		// TODO: avoid if-else
		if(astNode?.type === RType.BinaryOp) {
			switch(astNode.flavor) {
				case 'assignment': operationStack.push(new Assignment(astNode as RAssignmentOp<ParentInformation>)).enter(); break
				case 'arithmetic': operationStack.push(new BinOp(astNode)).enter(); break
				default: guard(false, `Unknown binary op ${astNode.flavor}`)
			}
		} else if(astNode?.type === RType.Symbol) {
			operationStack.peek()?.next({
				node:     astNode.info.id,
				domain:   getDomainOfDfgChild(node.id, dfg),
				debugMsg: 'Symbol'
			})
		} else if(astNode?.type === RType.Number){
			const num = astNode.content.num
			operationStack.peek()?.next({
				node:     astNode.info.id,
				domain:   domainFromScalar(num),
				debugMsg: 'Number'
			})
		} else if(node.type === CfgVertexType.EndMarker) {
			const operation = operationStack.pop()
			if(operation === undefined) {
				return
			}
			const operationResult = operation.exit()
			guard(!constraintMap.has(operationResult.node), `No constraint for the given ID ${operationResult.node}`)
			constraintMap.set(operationResult.node, operationResult)
			operationStack.peek()?.next(operationResult)
		} else {
			guard(false, `Unknown node type ${node.type}`)
		}
	})
	return dfg
}
