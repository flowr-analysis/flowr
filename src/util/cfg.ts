import {
	foldAst,
	FoldFunctions,
	NodeId,
	NormalizedAst,
	ParentInformation, RAccess, RFalse,
	RForLoop,
	RFunctionDefinition,
	RNodeWithParent,
	RRepeatLoop, RTrue,
	RWhileLoop
} from '../r-bridge'
import { MergeableRecord } from './objects'
import { setEquals } from './set'
import { graph2quads, QuadSerializationConfiguration } from './quads'

export interface CfgVertex {
	id:        NodeId
	name:      string
	/** the content may be undefined, if the node is an artificial exit point node that i use to mark the exit point of an if condition, a function, etc. */
	content:   string | undefined
	/** in case of a function definition */
	children?: NodeId[]
}

interface CfgFlowDependencyEdge extends MergeableRecord {
	label: 'FD'
}
interface CfgControlDependencyEdge extends MergeableRecord {
	label: 'CD'
	// TODO: more for switches etc.?
	when:  typeof RTrue | typeof RFalse
}

export type CFGEdge = CfgFlowDependencyEdge | CfgControlDependencyEdge

/**
 * This class represents the control flow graph of an R program.
 * The control flow may be hierarchical when confronted with function definitions (see {@link CfgVertex} and {@link CFG#rootVertexIds|rootVertexIds()}).
 */
export class CFG {
	private rootVertices:      Set<NodeId> = new Set<NodeId>()
	private vertexInformation: Map<NodeId, CfgVertex> = new Map<NodeId, CfgVertex>()
	private edgeInformation:   Map<NodeId, Map<NodeId, CFGEdge>> = new Map<NodeId, Map<NodeId, CFGEdge>>()

	addVertex(vertex: CfgVertex, rootVertex = true): this {
		if(this.vertexInformation.has(vertex.id)) {
			throw new Error(`Node with id ${vertex.id} already exists`)
		}
		this.vertexInformation.set(vertex.id, vertex)
		if(rootVertex) {
			this.rootVertices.add(vertex.id)
		}
		return this
	}

	addEdge(from: NodeId, to: NodeId, edge: CFGEdge): this {
		if(!this.edgeInformation.has(from)) {
			this.edgeInformation.set(from, new Map<NodeId, CFGEdge>())
		}
		this.edgeInformation.get(from)?.set(to, edge)
		return this
	}


	rootVertexIds(): ReadonlySet<NodeId> {
		return this.rootVertices
	}

	vertices(): ReadonlyMap<NodeId, CfgVertex> {
		return this.vertexInformation
	}

	edges(): ReadonlyMap<NodeId, ReadonlyMap<NodeId, CFGEdge>> {
		return this.edgeInformation
	}

	merge(other: CFG, forceNested = false): this {
		for(const [id, node] of other.vertexInformation) {
			this.addVertex(node, forceNested ? false : other.rootVertices.has(id))
		}
		for(const [from, edges] of other.edgeInformation) {
			for(const [to, edge] of edges) {
				this.addEdge(from, to, edge)
			}
		}
		return this
	}
}

export interface ControlFlowInformation extends MergeableRecord {
	returns:     NodeId[],
	breaks:      NodeId[],
	nexts:       NodeId[],
	/** intended to construct a hammock graph, with 0 exit points representing a block that should not be part of the CFG (like a comment) */
	entryPoints: NodeId[],
	/** See {@link ControlFlowInformation#entryPoints|entryPoints} */
	exitPoints:  NodeId[],
	graph:       CFG
}

export function emptyControlFlowInformation(): ControlFlowInformation {
	return {
		returns:     [],
		breaks:      [],
		nexts:       [],
		entryPoints: [],
		exitPoints:  [],
		graph:       new CFG()
	}
}


const cfgFolds: FoldFunctions<ParentInformation, ControlFlowInformation> = {
	foldNumber:  cfgLeaf,
	foldString:  cfgLeaf,
	foldLogical: cfgLeaf,
	foldSymbol:  cfgLeaf,
	foldAccess:  cfgAccess,
	binaryOp:    {
		foldLogicalOp:    cfgBinaryOp,
		foldArithmeticOp: cfgBinaryOp,
		foldComparisonOp: cfgBinaryOp,
		foldAssignment:   cfgBinaryOp,
		foldPipe:         cfgBinaryOp,
		foldModelFormula: cfgBinaryOp
	},
	unaryOp: {
		foldArithmeticOp: cfgUnaryOp,
		foldLogicalOp:    cfgUnaryOp,
		foldModelFormula: cfgUnaryOp
	},
	other: {
		foldComment:       cfgIgnore,
		foldLineDirective: cfgIgnore
	},
	loop: {
		foldFor:    cfgFor,
		foldRepeat: cfgRepeat,
		foldWhile:  cfgWhile,
		foldBreak:  cfgBreak,
		foldNext:   cfgNext
	},
	foldIfThenElse: cfgIfThenElse,
	foldExprList:   cfgExprList,
	functions:      {
		foldFunctionDefinition: cfgFunctionDefinition,
		foldFunctionCall:       cfgLeaf,
		foldParameter:          cfgLeaf,
		foldArgument:           cfgLeaf
	}
}

export function extractCFG<Info=ParentInformation>(ast: NormalizedAst<Info>): ControlFlowInformation {
	return foldAst(ast.ast, cfgFolds)
}


function getLexeme(n: RNodeWithParent) {
	return n.info.fullLexeme ?? n.lexeme ?? '<unknown>'
}

function cfgLeaf(leaf: RNodeWithParent): ControlFlowInformation {
	const graph = new CFG()
	graph.addVertex({ id: leaf.info.id, name: leaf.type, content: getLexeme(leaf) })
	return { graph, breaks: [], nexts: [], returns: [], exitPoints: [leaf.info.id], entryPoints: [leaf.info.id] }
}

function cfgBreak(leaf: RNodeWithParent): ControlFlowInformation {
	return { ...cfgLeaf(leaf), breaks: [leaf.info.id] }
}

function cfgNext(leaf: RNodeWithParent): ControlFlowInformation {
	return { ...cfgLeaf(leaf), nexts: [leaf.info.id] }
}

function cfgIgnore(_leaf: RNodeWithParent): ControlFlowInformation {
	return { graph: new CFG(), breaks: [], nexts: [], returns: [], exitPoints: [], entryPoints: [] }
}

function cfgIfThenElse(ifNode: RNodeWithParent, condition: ControlFlowInformation, then: ControlFlowInformation, otherwise: ControlFlowInformation | undefined): ControlFlowInformation {
	const graph = new CFG()
	graph.addVertex({ id: ifNode.info.id, name: ifNode.type, content: getLexeme(ifNode) })
	graph.addVertex({ id: ifNode.info.id + '-exit', name: 'if-exit', content: undefined })
	graph.merge(condition.graph)
	graph.merge(then.graph)
	if(otherwise) {
		graph.merge(otherwise.graph)
	}

	for(const exitPoint of condition.exitPoints) {
		for(const entryPoint of then.entryPoints) {
			graph.addEdge(entryPoint, exitPoint, { label: 'CD', when: RTrue })
		}
		for(const entryPoint of otherwise?.entryPoints ?? []) {
			graph.addEdge(entryPoint, exitPoint, { label: 'CD', when: RFalse })
		}
	}
	for(const entryPoint of condition.entryPoints) {
		graph.addEdge(entryPoint, ifNode.info.id, { label: 'FD' })
	}

	for(const exit of [...then.exitPoints, ...otherwise?.exitPoints ?? []]) {
		graph.addEdge(ifNode.info.id + '-exit', exit, { label: 'FD' })
	}
	if(!otherwise) {
		for(const exitPoint of condition.exitPoints) {
			graph.addEdge(ifNode.info.id + '-exit', exitPoint, { label: 'CD', when: RFalse })
		}
	}

	return {
		graph,
		breaks:      [...then.breaks, ...otherwise?.breaks ?? []],
		nexts:       [...then.nexts, ...otherwise?.nexts ?? []],
		returns:     [...then.returns, ...otherwise?.returns ?? []],
		exitPoints:  [ifNode.info.id + '-exit'],
		entryPoints: [ifNode.info.id]
	}
}

function cfgRepeat(repeat: RRepeatLoop<ParentInformation>, body: ControlFlowInformation): ControlFlowInformation {
	const graph = body.graph
	graph.addVertex({ id: repeat.info.id, name: repeat.type, content: getLexeme(repeat) })
	graph.addVertex({ id: repeat.info.id + '-exit', name: 'repeat-exit', content: undefined })

	for(const entryPoint of body.entryPoints) {
		graph.addEdge(repeat.info.id, entryPoint, { label: 'FD' })
	}

	// loops automatically
	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(repeat.info.id, next, { label: 'FD' })
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(repeat.info.id + '-exit', breakPoint, { label: 'FD' })
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [repeat.info.id + '-exit'], entryPoints: [repeat.info.id] }
}

function cfgWhile(whileLoop: RWhileLoop<ParentInformation>, condition: ControlFlowInformation, body: ControlFlowInformation): ControlFlowInformation {
	const graph = condition.graph
	graph.addVertex({ id: whileLoop.info.id, name: whileLoop.type, content: getLexeme(whileLoop) })
	graph.addVertex({ id: whileLoop.info.id + '-exit', name: 'while-exit', content: undefined })

	graph.merge(body.graph)

	for(const entry of condition.entryPoints) {
		graph.addEdge(entry, whileLoop.info.id, { label: 'FD' })
	}

	for(const exit of condition.exitPoints) {
		for(const entry of body.entryPoints) {
			graph.addEdge(entry, exit, { label: 'CD', when: RTrue })
		}
	}

	for(const entryPoint of body.entryPoints) {
		graph.addEdge(whileLoop.info.id, entryPoint, { label: 'FD' })
	}

	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(whileLoop.info.id, next, { label: 'FD' })
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(whileLoop.info.id + '-exit', breakPoint, { label: 'FD' })
	}
	// while can break on the condition as well
	for(const exit of condition.exitPoints) {
		graph.addEdge(whileLoop.info.id + '-exit', exit, { label: 'CD', when: RFalse })
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [whileLoop.info.id + '-exit'], entryPoints: [whileLoop.info.id] }
}

function cfgFor(forLoop: RForLoop<ParentInformation>, variable: ControlFlowInformation, vector: ControlFlowInformation, body: ControlFlowInformation): ControlFlowInformation {
	const graph = variable.graph
	graph.addVertex({ id: forLoop.info.id, name: forLoop.type, content: getLexeme(forLoop) })
	graph.addVertex({ id: forLoop.info.id + '-exit', name: 'for-exit', content: undefined })

	graph.merge(vector.graph)
	graph.merge(body.graph)

	for(const entry of vector.entryPoints) {
		graph.addEdge(entry, forLoop.info.id, { label: 'FD' })
	}

	for(const exit of vector.exitPoints) {
		for(const entry of variable.entryPoints) {
			graph.addEdge(entry, exit, { label: 'FD' })
		}
	}

	for(const exit of variable.exitPoints) {
		for(const entry of body.entryPoints) {
			graph.addEdge(entry, exit, { label: 'CD', when: RTrue })
		}
	}

	for(const entryPoint of body.entryPoints) {
		graph.addEdge(forLoop.info.id, entryPoint, { label: 'FD' })
	}

	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(forLoop.info.id, next, { label: 'FD' })
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(forLoop.info.id + '-exit', breakPoint, { label: 'FD' })
	}
	// while can break on the condition as well
	for(const exit of variable.exitPoints) {
		graph.addEdge(forLoop.info.id + '-exit', exit, { label: 'CD', when: RFalse })
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [forLoop.info.id + '-exit'], entryPoints: [forLoop.info.id] }
}

function cfgFunctionDefinition(fn: RFunctionDefinition<ParentInformation>, params: ControlFlowInformation[], body: ControlFlowInformation): ControlFlowInformation {
	const graph = new CFG()
	const children: NodeId[] = [fn.info.id + '-params', fn.info.id + '-exit']
	graph.addVertex({ id: fn.info.id + '-params', name: 'function-parameters', content: undefined }, false)
	graph.addVertex({ id: fn.info.id + '-exit', name: 'function-exit', content: undefined }, false)
	graph.addVertex({ id: fn.info.id, name: fn.type, content: getLexeme(fn), children })

	graph.merge(body.graph, true)
	children.push(...body.graph.rootVertexIds())

	// TODO: deal with their entry and exit points?
	for(const param of params) {
		graph.merge(param.graph, true)
		children.push(...param.graph.rootVertexIds())
		for(const entry of param.entryPoints) {
			graph.addEdge(entry, fn.info.id, { label: 'FD' })
		}
		for(const exit of param.exitPoints) {
			graph.addEdge(fn.info.id + '-params', exit, { label: 'FD' })
		}
	}
	for(const entry of body.entryPoints) {
		graph.addEdge(entry, fn.info.id + '-params',  { label: 'FD' })
	}

	// breaks and nexts should be illegal but safe is safe i guess
	for(const next of [...body.returns,...body.breaks,...body.nexts, ...body.exitPoints]) {
		graph.addEdge(fn.info.id + '-exit', next, { label: 'FD' })
	}

	return { graph: graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [fn.info.id], entryPoints: [fn.info.id] }
}

function cfgBinaryOp(binOp: RNodeWithParent, lhs: ControlFlowInformation, rhs: ControlFlowInformation): ControlFlowInformation {
	const graph = new CFG().merge(lhs.graph).merge(rhs.graph)
	const result: ControlFlowInformation = { graph, breaks: [...lhs.breaks, ...rhs.breaks], nexts: [...lhs.nexts, ...rhs.nexts], returns: [...lhs.returns, ...rhs.returns], exitPoints: [binOp.info.id], entryPoints: [...rhs.entryPoints] }

	graph.addVertex({ id: binOp.info.id, name: binOp.type, content: getLexeme(binOp) })

	for(const exitPoint of lhs.exitPoints) {
		for(const entryPoint of rhs.entryPoints) {
			result.graph.addEdge(entryPoint, exitPoint, { label: 'FD' })
		}
	}
	for(const entryPoint of lhs.entryPoints) {
		graph.addEdge(binOp.info.id, entryPoint, { label: 'FD' })
	}

	return result
}

function cfgAccess(access: RAccess<ParentInformation>, name: ControlFlowInformation, accessors: string | (ControlFlowInformation | null)[]): ControlFlowInformation {
	const result = name
	const graph = result.graph
	graph.addVertex({ id: access.info.id, name: access.type, content: getLexeme(access) })
	graph.addVertex({ id: access.info.id + '-exit', name: 'access-exit', content: undefined })
	for(const entry of name.entryPoints) {
		graph.addEdge(entry, access.info.id, { label: 'FD' })
	}
	for(const exit of name.exitPoints) {
		graph.addEdge(access.info.id, exit, { label: 'FD' })
	}
	result.entryPoints = [access.info.id]
	result.exitPoints = [access.info.id + '-exit']
	if(typeof accessors === 'string') {
		return result
	}
	for(const accessor of accessors) {
		if(accessor === null) {
			continue
		}
		graph.merge(accessor.graph)
		for(const entry of accessor.entryPoints) {
			graph.addEdge(entry, access.info.id, { label: 'FD' })
		}
		for(const exit of accessor.exitPoints) {
			graph.addEdge(access.info.id + '-exit', exit, { label: 'FD' })
		}
	}
	return result
}

function cfgUnaryOp(unary: RNodeWithParent, operand: ControlFlowInformation): ControlFlowInformation {
	const graph = operand.graph
	const result: ControlFlowInformation = { ...operand, graph, exitPoints: [unary.info.id] }

	graph.addVertex({ id: unary.info.id, name: unary.type, content: getLexeme(unary) })

	return result
}


function cfgExprList(_node: RNodeWithParent, expressions: ControlFlowInformation[]): ControlFlowInformation {
	const result: ControlFlowInformation = { graph: new CFG(), breaks: [], nexts: [], returns: [], exitPoints: [], entryPoints: [] }
	let first = true
	for(const expression of expressions) {
		if(first) {
			result.entryPoints = expression.entryPoints
			first = false
		} else {
			for(const previousExitPoint of result.exitPoints) {
				for(const entryPoint of expression.entryPoints) {
					result.graph.addEdge(entryPoint, previousExitPoint, { label: 'FD' })
				}
			}
		}
		result.graph.merge(expression.graph)
		result.breaks.push(...expression.breaks)
		result.nexts.push(...expression.nexts)
		result.returns.push(...expression.returns)
		// TODO: no FD after break/next/return?
		result.exitPoints = expression.exitPoints
	}
	return result
}

function equalChildren(a: NodeId[] | undefined, b: NodeId[] | undefined): boolean {
	if(!a || !b || a.length !== b.length) {
		return false
	}
	for(let i = 0; i < a.length; ++i) {
		if(a[i] !== b[i]) {
			return false
		}
	}
	return true
}

// TODO: outsource this
/**
 * Returns true if the given CFG equals the other CFG. False otherwise.
 */
export function equalCfg(a: CFG | undefined, b: CFG | undefined): boolean {
	if(!a || !b) {
		return a === b
	}
	else if(!setEquals(a.rootVertexIds(), b.rootVertexIds())) {
		return false
	}

	const aVert = a.vertices()
	const bVert = b.vertices()
	if(aVert.size !== bVert.size) {
		return false
	}
	for(const [id, aInfo] of aVert) {
		const bInfo = bVert.get(id)
		if(bInfo === undefined || aInfo.name !== bInfo.name || aInfo.content !== bInfo.content || equalChildren(aInfo.children, bInfo.children)) {
			return false
		}
	}

	const aEdges = a.edges()
	const bEdges = b.edges()
	if(aEdges.size !== bEdges.size) {
		return false
	}
	for(const [from, aTo] of aEdges) {
		const bTo = bEdges.get(from)
		if(bTo === undefined || aTo.size !== bTo.size) {
			return false
		}
		for(const [to, aEdge] of aTo) {
			const bEdge = bTo.get(to)
			if(bEdge === undefined || aEdge.label !== bEdge.label) {
				return false
			}
		}
	}

	return true
}


/**
 * @see df2quads
 * @see serialize2quads
 * @see graph2quads
 */
export function cfg2quads(cfg: ControlFlowInformation, config: QuadSerializationConfiguration): string {
	return graph2quads({
		rootIds:  [...cfg.graph.rootVertexIds()],
		vertices: [...cfg.graph.vertices().entries()]
			.map(([id, v]) => ({
				id,
				name:     v.name,
				content:  v.content,
				children: v.children
			})),
		edges: [...cfg.graph.edges()].flatMap(([fromId, targets]) =>
			[...targets].map(([toId, info]) => ({
				from: fromId,
				to:   toId,
				type: info.label,
				when: info.when
			}))
		),
		entryPoints: cfg.entryPoints,
		exitPoints:  cfg.exitPoints,
		breaks:      cfg.breaks,
		nexts:       cfg.nexts,
		returns:     cfg.returns
	},
	config
	)
}
