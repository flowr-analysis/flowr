import type { IdentifierReference } from '../environments'
import { diffEnvironmentInformation, diffIdentifierReferences } from '../environments'
import type { NodeId } from '../../r-bridge'
import { EmptyArgument } from '../../r-bridge'
import type { DataflowGraph, FunctionArgument, OutgoingEdges } from './graph'
import { isNamedArgument } from './graph'
import type { GenericDifferenceInformation, WriteableDifferenceReport } from '../../util/diff'
import { setDifference } from '../../util/diff'
import { jsonReplacer } from '../../util/json'
import { arrayEqual } from '../../util/arrays'
import { VertexType } from './vertex'
import type { DataflowGraphEdge } from './edge'

interface ProblematicVertex {
	tag: 'vertex',
	id:  NodeId
}

interface ProblematicEdge {
	tag:  'edge',
	from: NodeId,
	to:   NodeId
}

/*
function normalizeToNumberIfPossible(id: NodeId): NodeId {
	// check if string is number
	if(typeof id === 'string' && numIdRegex.test(id)) {
		return Number(id)
	}
	return id
}
*/

export function normalizeIdsForDiff<T>(id: T): T {
	/*if(typeof id === 'string' /!* || typeof id === 'number' *!/ ) {
		return String(id)
	} else if(Array.isArray(id)) {
		return id.map(String)
	} else {
		return new Set([...id].map(String))
	}*/
	return id
}

export type ProblematicDiffInfo = ProblematicVertex | ProblematicEdge

export class DataflowDifferenceReport implements WriteableDifferenceReport {
	_comments:    string[] | undefined      = undefined
	_problematic: ProblematicDiffInfo[] | undefined = undefined

	addComment(comment: string, ...related: ProblematicDiffInfo[]): void {
		if(this._comments === undefined) {
			this._comments = [comment]
		} else {
			this._comments.push(comment)
		}
		if(related.length > 0) {
			if(this._problematic === undefined) {
				this._problematic = [...related]
			} else {
				this._problematic.push(...related)
			}
		}
	}

	comments(): readonly string[] | undefined {
		return this._comments
	}

	problematic(): readonly ProblematicDiffInfo[] | undefined {
		return this._problematic
	}

	isEqual(): boolean {
		return this._comments === undefined
	}
}

export interface NamedGraph {
	name:  string,
	graph: DataflowGraph
}

interface DataflowDiffContext extends GenericDifferenceInformation<DataflowDifferenceReport> {
	left:  DataflowGraph
	right: DataflowGraph
}

function initDiffContext(left: NamedGraph, right: NamedGraph): DataflowDiffContext {
	return {
		left:      left.graph,
		leftname:  left.name,
		right:     right.graph,
		rightname: right.name,
		report:    new DataflowDifferenceReport(),
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
	const lEdges = new Map([...ctx.left.edges()].map(([k,v]) => ([normalizeIdsForDiff(k), v] as const)))
	const rEdges = new Map([...ctx.right.edges()].map(([k,v]) => ([normalizeIdsForDiff(k), v] as const)))
	if(lEdges.size !== rEdges.size) {
		ctx.report.addComment(`Detected different number of edges! ${ctx.leftname} has ${lEdges.size} (${JSON.stringify(lEdges, jsonReplacer)}). ${ctx.rightname} has ${rEdges.size} ${JSON.stringify(rEdges, jsonReplacer)}`)
	}

	for(const [id, edge] of lEdges) {
		diffEdges(ctx, id, edge, rEdges.get(normalizeIdsForDiff(id)))
	}
	// just to make it both ways in case the length differs
	for(const [id, edge] of rEdges) {
		if(!lEdges.has(normalizeIdsForDiff(id))) {
			diffEdges(ctx, id, undefined, edge)
		}
	}
}

function diffRootVertices(ctx: DataflowDiffContext): void {
	setDifference(normalizeIdsForDiff(ctx.left.rootIds()), normalizeIdsForDiff(ctx.right.rootIds()), { ...ctx, position: `${ctx.position}Root vertices differ in graphs. ` })
}


export function diffOfDataflowGraphs(left: NamedGraph, right: NamedGraph): DataflowDifferenceReport {
	if(left.graph === right.graph) {
		return new DataflowDifferenceReport()
	}
	const ctx = initDiffContext(left, right)
	diff(ctx)
	return ctx.report
}


function diffFunctionArgumentsReferences(fn: NodeId, a: IdentifierReference | '<value>', b: IdentifierReference | '<value>', ctx: GenericDifferenceInformation<DataflowDifferenceReport>): void {
	if(a === '<value>' || b === '<value>') {
		if(a !== b) {
			ctx.report.addComment(
				`${ctx.position}${ctx.leftname}: ${JSON.stringify(a, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(b, jsonReplacer)}`,
				{ tag: 'vertex', id: fn }
			)
		}
		return
	}
	diffIdentifierReferences(a, b, ctx)
}

export function equalFunctionArguments(fn: NodeId, a: false | readonly FunctionArgument[], b: false | readonly FunctionArgument[]): boolean {
	const ctx: GenericDifferenceInformation<DataflowDifferenceReport> = {
		report:    new DataflowDifferenceReport(),
		leftname:  'left',
		rightname: 'right',
		position:  ''
	}
	diffFunctionArguments(fn, a, b, ctx)
	return ctx.report.isEqual()
}

export function diffFunctionArguments(fn: NodeId, a: false | readonly FunctionArgument[], b: false | readonly FunctionArgument[], ctx: GenericDifferenceInformation<DataflowDifferenceReport>): void {
	if(a === false || b === false) {
		if(a !== b) {
			ctx.report.addComment(`${ctx.position}${ctx.leftname}: ${JSON.stringify(a, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(b, jsonReplacer)}`, { tag: 'vertex', id: fn })
		}
		return
	} else if(a.length !== b.length) {
		ctx.report.addComment(`${ctx.position}Differs in number of arguments. ${ctx.leftname}: ${JSON.stringify(a, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(b, jsonReplacer)}`, { tag: 'vertex', id: fn })
		return
	}
	for(let i = 0; i < a.length; ++i) {
		const aArg = a[i]
		const bArg = b[i]
		if(aArg === EmptyArgument || bArg === EmptyArgument) {
			if(aArg !== bArg) {
				ctx.report.addComment(`${ctx.position}In argument #${i} (of ${ctx.leftname}, empty) the argument differs: ${JSON.stringify(aArg)} vs ${JSON.stringify(bArg)}.`)
			}
			continue
		} else if(isNamedArgument(aArg) && isNamedArgument(bArg)) {
			// must have same name
			if(aArg.name !== bArg.name) {
				ctx.report.addComment(`${ctx.position }In argument #${i} (of ${ctx.leftname}, named) the name differs: ${aArg.name} vs ${bArg.name}.`)
				continue
			}
			diffFunctionArgumentsReferences(fn, aArg, bArg, {
				...ctx,
				position: `${ctx.position} In argument #${i} (of ${ctx.leftname}, named). `
			})
		} else {
			if(aArg.name !== bArg.name) {
				ctx.report.addComment(`${ctx.position}In argument #${i} (of ${ctx.leftname}, unnamed) the name differs: ${aArg.name} vs ${bArg.name}.`)
			}
			if(!arrayEqual(aArg.controlDependency, bArg.controlDependency)) {
				ctx.report.addComment(
					`${ctx.position}In argument #${i} (of ${ctx.leftname}, unnamed) the control dependency differs: ${JSON.stringify(aArg.controlDependency)} vs ${JSON.stringify(bArg.controlDependency)}.`,
					{ tag: 'vertex', id: fn }
				)
			}
		}
	}
}


export function diffVertices(ctx: DataflowDiffContext): void {
	// collect vertices from both sides
	const lVert = [...ctx.left.vertices(true)].map(([id, info]) => ([normalizeIdsForDiff(id), info] as const))
	const rVert = [...ctx.right.vertices(true)].map(([id, info]) => ([normalizeIdsForDiff(id), info] as const))
	if(lVert.length !== rVert.length) {
		ctx.report.addComment(`Detected different number of vertices! ${ctx.leftname} has ${lVert.length}, ${ctx.rightname} has ${rVert.length}`)
	}
	for(const [id, lInfo] of lVert) {
		const rInfoMay = ctx.right.get(id)
		if(rInfoMay === undefined) {
			ctx.report.addComment(`Vertex ${id} is not present in ${ctx.rightname}`, { tag: 'vertex', id })
			continue
		}
		const [rInfo] = rInfoMay
		if(lInfo.tag !== rInfo.tag) {
			ctx.report.addComment(`Vertex ${id} differs in tags. ${ctx.leftname}: ${lInfo.tag} vs. ${ctx.rightname}: ${rInfo.tag}`, { tag: 'vertex', id })
		}
		if(lInfo.name !== rInfo.name) {
			ctx.report.addComment(`Vertex ${id} differs in names. ${ctx.leftname}: ${lInfo.name} vs ${ctx.rightname}: ${rInfo.name}`, { tag: 'vertex', id })
		}
		if(!arrayEqual(lInfo.controlDependency, rInfo.controlDependency)) {
			ctx.report.addComment(
				`Vertex ${id} differs in controlDependency. ${ctx.leftname}: ${JSON.stringify(lInfo.controlDependency)} vs ${ctx.rightname}: ${JSON.stringify(rInfo.controlDependency)}`,
				{ tag: 'vertex', id }
			)
		}

		diffEnvironmentInformation(lInfo.environment, rInfo.environment, { ...ctx, position: `${ctx.position}Vertex ${id} differs in environment. ` })

		if(lInfo.tag === VertexType.FunctionCall) {
			if(rInfo.tag !== VertexType.FunctionCall) {
				ctx.report.addComment(`Vertex ${id} differs in tags. ${ctx.leftname}: ${lInfo.tag} vs. ${ctx.rightname}: ${rInfo.tag}`)
			} else {
				if(lInfo.onlyBuiltin !== rInfo.onlyBuiltin) {
					ctx.report.addComment(`Vertex ${id} differs in onlyBuiltin. ${ctx.leftname}: ${lInfo.onlyBuiltin} vs ${ctx.rightname}: ${rInfo.onlyBuiltin}`, { tag: 'vertex', id })
				}
				diffFunctionArguments(lInfo.id, lInfo.args, rInfo.args, {
					...ctx,
					position: `${ctx.position}Vertex ${id} (function call) differs in arguments. `
				})
			}
		}

		if(lInfo.tag === 'function-definition') {
			if(rInfo.tag !== 'function-definition') {
				ctx.report.addComment(`Vertex ${id} differs in tags. ${ctx.leftname}: ${lInfo.tag} vs. ${ctx.rightname}: ${rInfo.tag}`, { tag: 'vertex', id })
			} else {
				if(!arrayEqual(normalizeIdsForDiff(lInfo.exitPoints), normalizeIdsForDiff(rInfo.exitPoints))) {
					ctx.report.addComment(
						`Vertex ${id} differs in exit points. ${ctx.leftname}: ${JSON.stringify(lInfo.exitPoints, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(rInfo.exitPoints, jsonReplacer)}`,
						{ tag: 'vertex', id }
					)
				}

				diffEnvironmentInformation(lInfo.subflow.environment, rInfo.subflow.environment, {
					...ctx,
					position: `${ctx.position}Vertex ${id} (function definition) differs in subflow environments. `
				})
				setDifference(normalizeIdsForDiff(lInfo.subflow.graph), normalizeIdsForDiff(rInfo.subflow.graph), {
					...ctx,
					position: `${ctx.position}Vertex ${id} differs in subflow graph. `
				})
			}
		}
	}
}

function diffEdge(edge: DataflowGraphEdge, otherEdge: DataflowGraphEdge, ctx: DataflowDiffContext, id: NodeId, target: NodeId) {
	if(edge.types.size !== otherEdge.types.size) {
		ctx.report.addComment(
			`Target of ${id}->${target} in ${ctx.leftname} differs in number of edge types: ${JSON.stringify([...edge.types])} vs ${JSON.stringify([...otherEdge.types])}`,
			{ tag: 'edge', from: id, to: target }
		)
	}
	if([...edge.types].some(e => !otherEdge.types.has(e))) {
		ctx.report.addComment(
			`Target of ${id}->${target} in ${ctx.leftname} differs in edge types: ${JSON.stringify([...edge.types])} vs ${JSON.stringify([...otherEdge.types])}`,
			{ tag: 'edge', from: id, to: target }
		)
	}
}

export function diffEdges(ctx: DataflowDiffContext, id: NodeId, lEdges: OutgoingEdges | undefined, rEdges: OutgoingEdges | undefined): void {
	if(lEdges === undefined || rEdges === undefined) {
		if(lEdges !== rEdges) {
			ctx.report.addComment(
				`Vertex ${id} has undefined outgoing edges. ${ctx.leftname}: ${JSON.stringify(lEdges, jsonReplacer)} vs ${ctx.rightname}: ${JSON.stringify(rEdges, jsonReplacer)}`,
				{ tag: 'vertex', id }
			)
		}
		return
	}

	if(lEdges.size !== rEdges.size) {
		ctx.report.addComment(
			`Vertex ${id} differs in number of outgoing edges. ${ctx.leftname}: [${[...lEdges.keys()].join(',')}] vs ${ctx.rightname}: [${[...rEdges.keys()].join(',')}] `,
			{ tag: 'vertex', id }
		)
	}
	// order independent compare
	for(const [target, edge] of lEdges) {
		const otherEdge = rEdges.get(normalizeIdsForDiff(target))
		if(otherEdge === undefined) {
			ctx.report.addComment(
				`Target of ${id}->${target} in ${ctx.leftname} is not present in ${ctx.rightname}`,
				{ tag: 'edge', from: id, to: target }
			)
			continue
		}
		diffEdge(edge, otherEdge, ctx, id, target)
	}
}
