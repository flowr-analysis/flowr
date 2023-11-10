import { environmentsEqual, equalIdentifierReferences, IdentifierReference } from '../environments'
import { NodeId } from '../../r-bridge'
import { DataflowGraph, FunctionArgument, OutgoingEdges, PositionalFunctionArgument } from './graph'
import { DataflowGraphVertexInfo, DataflowGraphVertices, dataflowLogger } from '../index'
import { guard } from '../../util/assert'
import { jsonReplacer } from '../../util/json'
import { setDifference, setEquals } from '../../util/set'

export class DifferenceReport {
	/** A human-readable description of differences during the comparison */
	comments: string[] | undefined      = undefined

	addComment(comment: string): void {
		if(this.comments === undefined) {
			this.comments = [comment]
		} else {
			this.comments.push(comment)
		}
	}
}

interface DataflowPosition {
	currentVertex: NodeId,
	graphSide:     'left' | 'right',
	atEdge:        boolean
}

export interface NamedGraph {
	name:  string,
	graph: DataflowGraph
}

interface DataflowDiffContext {
	left:      DataflowGraph
	leftname:  string
	right:     DataflowGraph
	rightname: string
	report:    DifferenceReport
	/** the current position when diffing in the graph (allows sub-vertex comparison to provide more useful information) */
	position:  DataflowPosition | undefined
}

function initDiffContext(left: NamedGraph, right: NamedGraph) {
	return {
		left:      left.graph,
		leftname:  left.name,
		right:     right.graph,
		rightname: right.name,
		report:    new DifferenceReport()
	}
}

function diff(ctx: DataflowDiffContext): boolean {
	diffRootVertices(ctx)
	diffVertices(ctx)

	if(this.edgeInformation.size !== other.edgeInformation.size) {
		dataflowLogger.debug(`different numbers of vertices with edges: ${this.edgeInformation.size} vs ${other.edgeInformation.size}`)
		return false
	}

	for(const [id, edge] of this.edgeInformation.entries()) {
		if(!equalEdges(id, edge, other.edgeInformation.get(id))) {
			return false
		}
	}

	return true
}

function diffRootVertices(ctx: DataflowDiffContext): void {
	const lWithoutR = setDifference(ctx.left.rootIds(), ctx.right.rootIds())
	const rWithoutL = setDifference(ctx.right.rootIds(), ctx.left.rootIds())
	if(lWithoutR.size === 0 && rWithoutL.size === 0) {
		return
	}
	let message = 'Root vertices do not match'
	if(lWithoutR.size > 0) {
		message += ` in ${ctx.leftname}: ${JSON.stringify([...lWithoutR])}`
	}
	if(rWithoutL.size > 0) {
		if(lWithoutR.size > 0) {
			message += ' and'
		}
		message += ` in ${ctx.rightname}: ${JSON.stringify([...rWithoutL])}`
	}
	ctx.report.addComment(message)
}


export function diffOfDataflowGraphs(left: DataflowGraph, right: DataflowGraph): 'equal' | DifferenceReport {
	if(left === right) {
		return 'equal'
	}


}


function equalFunctionArgumentsReferences(a: IdentifierReference | '<value>', b: IdentifierReference | '<value>'): boolean {
	if(a === '<value>' || b === '<value>') {
		return a === b
	}
	return equalIdentifierReferences(a, b)
}

export function equalExitPoints(a: NodeId[] | undefined, b: NodeId[] | undefined): boolean {
	if(a === undefined || b === undefined) {
		return a === b
	}
	if(a.length !== b.length) {
		return false
	}
	for(let i = 0; i < a.length; ++i) {
		if(a[i] !== b[i]) {
			return false
		}
	}
	return true
}

export function equalFunctionArguments(a: false | FunctionArgument[], b: false | FunctionArgument[]): boolean {
	if(a === false || b === false) {
		return a === b
	}
	else if(a.length !== b.length) {
		return false
	}
	for(let i = 0; i < a.length; ++i) {
		const aArg = a[i]
		const bArg = b[i]
		if(Array.isArray(aArg) && Array.isArray(bArg)) {
			// must have same name
			if(aArg[0] !== bArg[0]) {
				return false
			}
			if(!equalFunctionArgumentsReferences(aArg[1], bArg[1])) {
				return false
			}
		} else if(!equalFunctionArgumentsReferences(aArg as PositionalFunctionArgument, bArg as PositionalFunctionArgument)) {
			return false
		}
	}
	return true
}


export function equalVertices(ctx: DataflowDiffContext): void {
	// collect vertices from both sides
	const lVert = [...ctx.left.vertices(true)]
	const rVert = [...ctx.right.vertices(true)]
	if(lVert.length !== rVert.length) {
		ctx.report.addComment(`Detected different number of vertices! ${ctx.leftname} has ${lVert.length}, ${ctx.rightname} has ${rVert.length}`)
	}
	for(const [id, lInfo] of lVert) {
		const rInfo = ctx.right.get(id)
		if(rInfo === undefined) {
			ctx.report.addComment(`Vertex ${id} is not present in ${ctx.rightname}`)
			continue
		} else {
			if(lInfo.tag !== rInfo[0].tag) {
				ctx.report.addComment(`Vertex ${id} has different tags. ${ctx.leftname}: ${lInfo.tag} vs. ${ctx.rightname}: ${rInfo[0].tag}`)
			}
			if(lInfo.name !== rInfo[0].name) {
				ctx.report.addComment(`Vertex ${id} has different names: ${ctx.leftname}: ${lInfo.name} vs ${ctx.rightname}: ${rInfo[0].name}`)
			}
		}

		if(lInfo.tag === 'variable-definition' || rInfo[0].tag === 'function-definition') {
			guard(lInfo.tag === rInfo[0].tag, () => `node ${id} does not match on tag (${lInfo.tag} vs ${rInfo[0].tag})`)
			if(lInfo.scope !== rInfo[0].scope) {
				ctx.report.addComment(`Vertex ${id} has different scopes: ${ctx.leftname}: ${lInfo.scope} vs ${ctx.rightname}: ${rInfo[0].scope}`)
			}
		}

		if(lInfo.when !== rInfo[0].when) {
			ctx.report.addComment(`Vertex ${id} has different when: ${ctx.leftname}: ${lInfo.when} vs ${ctx.rightname}: ${rInfo[0].when}`)
		}

		// TODO: diff environments
		if(!environmentsEqual(lInfo.environment, rInfo[0].environment)) {
			ctx.report.addComment(`Vertex ${id} has different environments: ${ctx.leftname}: ${JSON.stringify(lInfo.environment)} vs ${ctx.rightname}: ${JSON.stringify(rInfo[0].environment)}`)
		}

		if(lInfo.tag === 'function-call') {
			guard(rInfo[0].tag === 'function-call', 'otherInfo must be a function call as well')
			// TODO diff:
			if(!equalFunctionArguments(lInfo.args, rInfo[0].args)) {
				dataflowLogger.warn(`node ${id} does not match on function arguments (${JSON.stringify(info.args)} vs ${JSON.stringify(otherInfo.args)})`)
			}
		}

		if(info.tag === 'function-definition') {
			guard(otherInfo.tag === 'function-definition', 'otherInfo must be a function definition as well')

			if(!equalExitPoints(info.exitPoints, otherInfo.exitPoints)) {
				dataflowLogger.warn(`node ${id} does not match on exit points (${JSON.stringify(info.exitPoints)} vs ${JSON.stringify(otherInfo.exitPoints)})`)
				return false
			}

			if(info.subflow.scope !== otherInfo.subflow.scope || !environmentsEqual(info.subflow.environments, otherInfo.subflow.environments)) {
				dataflowLogger.warn(`node ${id} does not match on subflow (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
				return false
			}
			if(!setEquals(info.subflow.graph, otherInfo.subflow.graph)) {
				dataflowLogger.warn(`node ${id} does not match on subflow graph (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
				return false
			}
		}
	}
	return true
}




export function equalEdges(id: NodeId, our: OutgoingEdges | undefined, other: OutgoingEdges | undefined): boolean {
	if(our === undefined || other === undefined) {
		return our === other
	}

	if(our.size !== other.size) {
		dataflowLogger.warn(`total edge size for ${id} does not match: ${our.size} vs ${other.size} (${JSON.stringify(our, jsonReplacer)}, ${JSON.stringify(other, jsonReplacer)})`)
		return false
	}
	// order independent compare
	for(const [target, edge] of our) {
		const otherEdge = other.get(target)
		if(otherEdge === undefined || edge.types.size !== otherEdge.types.size || [...edge.types].some(e => !otherEdge.types.has(e)) || edge.attribute !== otherEdge.attribute) {
			dataflowLogger.warn(`edge with ${id}->${target} does not match (${JSON.stringify(edge, jsonReplacer)} vs ${JSON.stringify(otherEdge, jsonReplacer)})`)
			return false
		}
	}
	return true
}

