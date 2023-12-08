import {DataflowInformation} from '../dataflow/internal/info'
import {NodeId, NormalizedAst, ParentInformation, RAssignmentOp, RBinaryOp, RType} from '../r-bridge'
import {CfgVertexType, extractCFG} from '../util/cfg/cfg'
import {visitCfg} from '../util/cfg/visitor'
import {assertUnreachable, guard} from '../util/assert'
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

interface Handler<ValueType> {
	name:  string,
	enter: () => void
	exit:  () => ValueType
	next:  (value: ValueType) => void
}

interface IntervalBound {
	value:     number,
	inclusive: boolean
}

class Interval {
	readonly min: IntervalBound
	readonly max: IntervalBound

	constructor(min: IntervalBound, max: IntervalBound) {
		guard(min.value <= max.value, `The interval ${this.toString()} has a minimum that is greater than its maximum`)
		guard(min.value !== max.value || (min.inclusive === max.inclusive), `The bound ${min.value} cannot be in- and exclusive at the same time`)
		this.min = min
		this.max = max
	}

	toString(): string {
		return `${this.min.inclusive ? '[' : '('}${this.min.value}, ${this.max.value}${this.max.inclusive ? ']' : ')'}`
	}
}

class Domain extends Set<Interval> {
	constructor(...intervals: Interval[]) {
		super(intervals)
	}

	toString(): string {
		return `{${Array.from(this).join(', ')}}`
	}
}

interface Constraints {
	node:     NodeId,
	domain:   Domain,
	debugMsg: string
}

const enum CompareType {
	/** The bound that's inclusive is the smaller one */
	Min,
	/** The bound that's inclusive is the greater one */
	Max
}

function compareIntervals(compareType: CompareType, interval1: IntervalBound, interval2: IntervalBound): number {
	const diff = interval1.value - interval2.value
	if(diff !== 0) {
		return diff
	}
	switch(compareType) {
		case CompareType.Min: return Number(!interval1.inclusive) - Number(!interval2.inclusive)
		case CompareType.Max: return Number(interval1.inclusive) - Number(interval2.inclusive)
		default: assertUnreachable(compareType)
	}
}

function compareIntervalsByTheirMinimum(interval1: Interval, interval2: Interval): number {
	return compareIntervals(CompareType.Min, interval1.min, interval2.min)
}

function compareIntervalsByTheirMaximum(interval1: Interval, interval2: Interval): number {
	return compareIntervals(CompareType.Max, interval1.max, interval2.max)
}

function doIntervalsOverlap(interval1: Interval, interval2: Interval): boolean {
	const diff1 = compareIntervals(CompareType.Max, interval1.max, interval2.min)
	const diff2 = compareIntervals(CompareType.Max, interval2.max, interval1.min)

	// If one interval ends before the other starts, they don't overlap
	if(diff1 < 0 || diff2 < 0) {
		return false
	}
	// If their end and start are equal, they only overlap if both are inclusive
	if(diff1 === 0) {
		return interval1.max.inclusive && interval2.min.inclusive
	}
	if(diff2 === 0) {
		return interval2.max.inclusive && interval1.min.inclusive
	}

	return true
}

function unifyDomains(domains: Domain[]) : Domain {
	const sortedIntervals = domains.flatMap(domain => [...domain]).sort(compareIntervalsByTheirMinimum)
	if(sortedIntervals.length === 0) {
		return new Domain()
	}

	const unifiedDomain = new Domain()
	let currentInterval = sortedIntervals[0]
	for(const nextInterval of sortedIntervals) {
		if(doIntervalsOverlap(currentInterval, nextInterval)) {
			const intervalWithEarlierStart = compareIntervalsByTheirMinimum(currentInterval, nextInterval) < 0 ? currentInterval : nextInterval
			const intervalWithLaterEnd = compareIntervalsByTheirMaximum(currentInterval, nextInterval) > 0 ? currentInterval : nextInterval
			currentInterval = {
				min: intervalWithEarlierStart.min,
				max: intervalWithLaterEnd.max,
			}
		} else {
			unifiedDomain.add(currentInterval)
			currentInterval = nextInterval
		}
	}
	unifiedDomain.add(currentInterval)
	return unifiedDomain
}

// Bottom -> optionales dirty flag
// infinity -> infinity (+ * Inclusive: false)
function domainFromScalar(n: number): Domain {
	return new Domain({
		min: {value: n, inclusive: true},
		max: {value: n, inclusive: true}}
	)
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

class Assignment implements Handler<Constraints> {
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
			domain:   new Domain(), // TODO: check interval of the assignments source
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

class BinOp implements Handler<Constraints> {
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
			domain:   new Domain(), // TODO: Check the operands constraints and see how the operation affects those
			debugMsg: this.name
		}
	}

	next(value: Constraints): void {
		console.log(`${this.name} received ${value.debugMsg}`)
	}
}

export function runAbstractInterpretation(ast: NormalizedAst, dfg: DataflowInformation): DataflowInformation {
	const cfg = extractCFG(ast)
	const operationStack = new Stack<Handler<Constraints>>()
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
