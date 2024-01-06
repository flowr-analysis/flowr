import {DataflowInformation} from '../dataflow/internal/info'
import {NodeId, NormalizedAst, ParentInformation, RAssignmentOp, RBinaryOp, RNodeWithParent, RType} from '../r-bridge'
import {CfgVertexType, extractCFG} from '../util/cfg/cfg'
import {visitCfg} from '../util/cfg/visitor'
import {assertUnreachable, guard} from '../util/assert'
import {DataflowGraphVertexInfo, EdgeType, OutgoingEdges} from '../dataflow'

interface AINode {
	readonly id:      NodeId
	readonly domain:  Domain
	readonly astNode: RNodeWithParent<ParentInformation>
}

const nodeMap = new Map<NodeId, AINode>()

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

export interface IntervalBound {
	value:     number,
	inclusive: boolean
}

export class Interval {
	readonly min: IntervalBound
	readonly max: IntervalBound

	constructor(min: IntervalBound, max: IntervalBound) {
		this.min = min
		this.max = max
		guard(min.value <= max.value, `The interval ${this.toString()} has a minimum that is greater than its maximum`)
		guard(min.value !== max.value || (min.inclusive === max.inclusive), `The bound ${min.value} cannot be in- and exclusive at the same time`)
	}

	toString(): string {
		return `${this.min.inclusive ? '[' : '('}${this.min.value}, ${this.max.value}${this.max.inclusive ? ']' : ')'}`
	}
}

export class Domain {
	private readonly _intervals: Set<Interval>

	constructor(...intervals: Interval[]) {
		this._intervals = new Set(intervals)
	}

	get intervals(): Set<Interval> {
		return this._intervals
	}

	addInterval(interval: Interval): void {
		// TODO: check if the interval overlaps with any of the existing ones
		this.intervals.add(interval)
	}

	toString(): string {
		return `{${Array.from(this.intervals).join(', ')}}`
	}
}

export const enum CompareType {
	/** The bound that's inclusive is the smaller one */
	Min,
	/** The bound that's inclusive is the greater one */
	Max,
	/** Equality is only based on the "raw" values */
	IgnoreInclusivity
}

export function compareIntervals(compareType: CompareType, interval1: IntervalBound, interval2: IntervalBound): number {
	const diff = interval1.value - interval2.value
	if(diff !== 0 || compareType === CompareType.IgnoreInclusivity) {
		return diff
	}
	switch(compareType) {
		case CompareType.Min: return Number(!interval1.inclusive) - Number(!interval2.inclusive)
		case CompareType.Max: return Number(interval1.inclusive) - Number(interval2.inclusive)
		default: assertUnreachable(compareType)
	}
}

export function compareIntervalsByTheirMinimum(interval1: Interval, interval2: Interval): number {
	return compareIntervals(CompareType.Min, interval1.min, interval2.min)
}

export function compareIntervalsByTheirMaximum(interval1: Interval, interval2: Interval): number {
	return compareIntervals(CompareType.Max, interval1.max, interval2.max)
}

export function doIntervalsOverlap(interval1: Interval, interval2: Interval): boolean {
	const diff1 = compareIntervals(CompareType.IgnoreInclusivity, interval1.max, interval2.min)
	const diff2 = compareIntervals(CompareType.IgnoreInclusivity, interval2.max, interval1.min)

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

export function unifyDomains(domains: Domain[]) : Domain {
	const sortedIntervals = domains.flatMap(domain => [...domain.intervals]).sort(compareIntervalsByTheirMinimum)
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
			unifiedDomain.addInterval(currentInterval)
			currentInterval = nextInterval
		}
	}
	unifiedDomain.addInterval(currentInterval)
	return unifiedDomain
}

// Bottom -> optionales dirty flag
// infinity -> infinity (+ * Inclusive: false)
export function domainFromScalar(n: number): Domain {
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
	const domains: Domain[] = []
	for(const id of ids) {
		const domain = nodeMap.get(id)?.domain
		guard(domain !== undefined, `No domain found for ID ${id}`)
		domains.push(domain)
	}
	return unifyDomains(domains)
}

class Assignment implements Handler<AINode> {
	private lhs:           AINode | undefined
	private rhs:           AINode | undefined
	private readonly node: RAssignmentOp<ParentInformation>

	constructor(node: RAssignmentOp<ParentInformation>) {
		this.node = node
	}

	name = 'Assignment'

	enter(): void {
		console.log(`Entered ${this.name} ${this.node.info.id}`)
	}

	exit(): AINode {
		console.log(`Exited ${this.name} ${this.node.info.id}`)
		guard(this.lhs !== undefined, `No LHS found for assignment ${this.node.info.id}`)
		guard(this.rhs !== undefined, `No RHS found for assignment ${this.node.info.id}`)
		return {
			id:      this.lhs.id,
			domain:  this.rhs.domain,
			astNode: this.node.lhs,
		}
	}

	next(node: AINode): void {
		if(this.lhs === undefined) {
			this.lhs = node
		} else if(this.rhs === undefined){
			this.rhs = node
		} else {
			guard(false, `Assignment ${this.node.info.id} already has both LHS and RHS`)
		}
		console.log(`${this.name} received`)
	}
}

class BinOp implements Handler<AINode> {
	private readonly node: RBinaryOp<ParentInformation>

	constructor(node: RBinaryOp<ParentInformation>) {
		this.node = node
	}

	name = 'Bin Op'

	enter(): void {
		console.log(`Entered ${this.name}`)
	}

	exit(): AINode {
		console.log(`Exited ${this.name}`)
		return {
			id:      this.node.info.id,
			domain:  new Domain(), // TODO: Check the operands domains and see how the operation affects those
			astNode: this.node,
		}
	}

	next(_: AINode): void {
		console.log(`${this.name} received`)
	}
}

export function runAbstractInterpretation(ast: NormalizedAst, dfg: DataflowInformation): DataflowInformation {
	const cfg = extractCFG(ast)
	const operationStack = new Stack<Handler<AINode>>()
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
				id:      astNode.info.id,
				domain:  getDomainOfDfgChild(node.id, dfg),
				astNode: astNode,
			})
		} else if(astNode?.type === RType.Number){
			const num = astNode.content.num
			operationStack.peek()?.next({
				id:      astNode.info.id,
				domain:  domainFromScalar(num),
				astNode: astNode,
			})
		} else if(node.type === CfgVertexType.EndMarker) {
			const operation = operationStack.pop()
			if(operation === undefined) {
				return
			}
			const operationResult = operation.exit()
			guard(!nodeMap.has(operationResult.id), `Domain for ID ${operationResult.id} already exists`)
			nodeMap.set(operationResult.id, operationResult)
			operationStack.peek()?.next(operationResult)
		} else {
			guard(false, `Unknown node type ${node.type}`)
		}
	})
	return dfg
}
