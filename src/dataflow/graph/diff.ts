import { environmentsEqual, equalIdentifierReferences, IdentifierReference } from '../environments'
import { NodeId } from '../../r-bridge'
import { DataflowGraph, FunctionArgument, OutgoingEdges, PositionalFunctionArgument } from './graph'
import { guard } from '../../util/assert'
import {
	setDifference,
	GenericDifferenceInformation,
	WriteableDifferenceReport, DifferenceReport
} from '../../util/diff'

class DataflowDifferenceReport implements WriteableDifferenceReport {
	_comments: string[] | undefined      = undefined

	addComment(comment: string): void {
		if(this._comments === undefined) {
			this._comments = [comment]
		} else {
			this._comments.push(comment)
		}
	}

	comments(): readonly string[] | undefined {
		return this._comments
	}

	isEqual(): boolean {
		return this._comments === undefined
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

interface DataflowDiffContext extends GenericDifferenceInformation {
	left:  DataflowGraph
	right: DataflowGraph
	/** TODO: the current position when diffing in the graph (allows sub-vertex comparison to provide more useful information) */
	// position: DataflowPosition | undefined
}

function initDiffContext(left: NamedGraph, right: NamedGraph): DataflowDiffContext {
	return {
		left:      left.graph,
		leftname:  left.name,
		right:     right.graph,
		rightname: right.name,
		report:    new DataflowDifferenceReport(),
		// TODO: handle the current position as well
		position:  ''
	}
}

function diff(ctx: DataflowDiffContext): boolean {
	diffRootVertices(ctx)
	diffVertices(ctx)
	diffOutgoingEdges(ctx)
	return true
}


function diffOutgoingEdges(ctx: DataflowDiffContext): void {
	const lEdges = new Map(ctx.left.edges())
	const rEdges = new Map(ctx.right.edges())
	if(lEdges.size !== rEdges.size) {
		ctx.report.addComment(`Detected different number of edges! ${ctx.leftname} has ${lEdges.size}, ${ctx.rightname} has ${rEdges.size}`)
	}

	for(const [id, edge] of lEdges) {
		diffEdges(ctx, id, edge, rEdges.get(id))
	}
	// TODO: check rEdges as well!
}

function diffRootVertices(ctx: DataflowDiffContext): void {
	setDifference(ctx.left.rootIds(), ctx.right.rootIds(), ctx)
}


export function diffOfDataflowGraphs(left: NamedGraph, right: NamedGraph): DifferenceReport {
	if(left.graph === right.graph) {
		return new DataflowDifferenceReport()
	}
	const ctx = initDiffContext(left, right)
	diff(ctx)
	return ctx.report
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


export function diffVertices(ctx: DataflowDiffContext): void {
	// collect vertices from both sides
	const lVert = [...ctx.left.vertices(true)]
	const rVert = [...ctx.right.vertices(true)]
	if(lVert.length !== rVert.length) {
		ctx.report.addComment(`Detected different number of vertices! ${ctx.leftname} has ${lVert.length}, ${ctx.rightname} has ${rVert.length}`)
	}
	for(const [id, lInfo] of lVert) {
		const rInfoMay = ctx.right.get(id)
		if(rInfoMay === undefined) {
			ctx.report.addComment(`Vertex ${id} is not present in ${ctx.rightname}`)
			continue
		}
		const [rInfo] = rInfoMay
		if(lInfo.tag !== rInfo.tag) {
			ctx.report.addComment(`Vertex ${id} has different tags. ${ctx.leftname}: ${lInfo.tag} vs. ${ctx.rightname}: ${rInfo.tag}`)
		}
		if(lInfo.name !== rInfo.name) {
			ctx.report.addComment(`Vertex ${id} has different names. ${ctx.leftname}: ${lInfo.name} vs ${ctx.rightname}: ${rInfo.name}`)
		}

		if(lInfo.tag === 'variable-definition' || lInfo.tag === 'function-definition') {
			guard(lInfo.tag === rInfo.tag, () => `node ${id} does not match on tag (${lInfo.tag} vs ${rInfo.tag})`)
			if(lInfo.scope !== rInfo.scope) {
				ctx.report.addComment(`Vertex ${id} has different scopes. ${ctx.leftname}: ${lInfo.scope} vs ${ctx.rightname}: ${rInfo.scope}`)
			}
		}

		if(lInfo.when !== rInfo.when) {
			ctx.report.addComment(`Vertex ${id} has different when. ${ctx.leftname}: ${lInfo.when} vs ${ctx.rightname}: ${rInfo.when}`)
		}

		// TODO: diff environments
		if(!environmentsEqual(lInfo.environment, rInfo.environment)) {
			ctx.report.addComment(`Vertex ${id} has different environments. ${ctx.leftname}: ${JSON.stringify(lInfo.environment)} vs ${ctx.rightname}: ${JSON.stringify(rInfo.environment)}`)
		}

		if(lInfo.tag === 'function-call') {
			guard(rInfo.tag === 'function-call', 'otherInfo must be a function call as well')
			// TODO diff:
			if(!equalFunctionArguments(lInfo.args, rInfo.args)) {
				ctx.report.addComment(`Vertex ${id} has different arguments. ${ctx.leftname}: ${JSON.stringify(lInfo.args)} vs ${ctx.rightname}: ${JSON.stringify(rInfo.args)}`)
			}
		}

		if(lInfo.tag === 'function-definition') {
			guard(rInfo.tag === 'function-definition', 'otherInfo must be a function definition as well')

			if(!equalExitPoints(lInfo.exitPoints, rInfo.exitPoints)) {
				ctx.report.addComment(`Vertex ${id} has different exit points. ${ctx.leftname}: ${JSON.stringify(lInfo.exitPoints)} vs ${ctx.rightname}: ${JSON.stringify(rInfo.exitPoints)}`)
			}

			if(lInfo.subflow.scope !== rInfo.subflow.scope || !environmentsEqual(lInfo.subflow.environments, rInfo.subflow.environments)) {
				ctx.report.addComment(`Vertex ${id} has different subflow. ${ctx.leftname}: ${JSON.stringify(lInfo.subflow)} vs ${ctx.rightname}: ${JSON.stringify(rInfo.subflow)}`)
			}
			setDifference(lInfo.subflow.graph, rInfo.subflow.graph, {...ctx, position: `Vertex ${id} differs in subflow graph.` })
		}
	}
}

export function diffEdges(ctx: DataflowDiffContext, id: NodeId, lEdges: OutgoingEdges | undefined, rEdges: OutgoingEdges | undefined): void {
	if(lEdges === undefined || rEdges === undefined) {
		if(lEdges !== rEdges) {
			ctx.report.addComment(`Vertex ${id} has undefined outgoing edges. ${ctx.leftname}: ${JSON.stringify(lEdges)} vs ${ctx.rightname}: ${JSON.stringify(rEdges)}`)
		}
		return
	}

	if(lEdges.size !== rEdges.size) {
		ctx.report.addComment(`Vertex ${id} has different number of outgoing edges. ${ctx.leftname}: ${JSON.stringify(lEdges)} vs ${ctx.rightname}: ${JSON.stringify(rEdges)}`)
	}
	// order independent compare
	for(const [target, edge] of lEdges) {
		const otherEdge = rEdges.get(target)
		if(otherEdge === undefined) {
			ctx.report.addComment(`Target of ${id}->${target} in ${ctx.leftname} is not present in ${ctx.rightname}`)
			continue
		}
		if(edge.types.size !== otherEdge.types.size) {
			ctx.report.addComment(`Target of ${id}->${target} in ${ctx.leftname} has different number of edge types: ${JSON.stringify([...edge.types])} vs ${JSON.stringify([...otherEdge.types])}`)
		}
		if([...edge.types].some(e => !otherEdge.types.has(e))) {
			ctx.report.addComment(`Target of ${id}->${target} in ${ctx.leftname} has different edge types: ${JSON.stringify([...edge.types])} vs ${JSON.stringify([...otherEdge.types])}`)
		}
		if(edge.attribute !== otherEdge.attribute) {
			ctx.report.addComment(`Target of ${id}->${target} in ${ctx.leftname} has different attributes: ${JSON.stringify(edge.attribute)} vs ${JSON.stringify(otherEdge.attribute)}`)
		}
	}
}
