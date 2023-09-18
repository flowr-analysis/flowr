import {
  foldAst,
  FoldFunctions,
  NodeId, NormalizedAst, ParentInformation, RNodeWithParent
} from '../r-bridge'
import { MergeableRecord } from './objects'

interface CFGVertex {
  id:      NodeId
  name:    string
  content: string
  /** in case of a function definition */
  children: NodeId[]
}

export interface CFGEdge {
  label:     string
}

class CFG {
  private rootVertices:      Set<NodeId> = new Set<NodeId>()
  private vertexInformation: Map<NodeId, CFGVertex> = new Map<NodeId, CFGVertex>()
  private edgeInformation:   Map<NodeId, Map<NodeId, CFGEdge>> = new Map<NodeId, Map<NodeId, CFGEdge>>()

  addNode(node: CFGVertex, rootVertex = true): void {
    if(this.vertexInformation.has(node.id)) {
      throw new Error(`Node with id ${node.id} already exists`)
    }
    this.vertexInformation.set(node.id, node)
    if(rootVertex) {
      this.rootVertices.add(node.id)
    }
  }

  addEdge(from: NodeId, to: NodeId, edge: CFGEdge): void {
    if(!this.edgeInformation.has(from)) {
      this.edgeInformation.set(from, new Map<NodeId, CFGEdge>())
    }
    this.edgeInformation.get(from)?.set(to, edge)
  }


  rootVertexIds(): ReadonlySet<NodeId> {
    return this.rootVertices
  }

  vertices(): ReadonlyMap<NodeId, CFGVertex> {
    return this.vertexInformation
  }

  edges(): ReadonlyMap<NodeId, ReadonlyMap<NodeId, CFGEdge>> {
    return this.edgeInformation
  }

  merge(other: CFG): void {
    for(const [id, node] of other.vertexInformation) {
      this.addNode(node, other.rootVertices.has(id))
    }
    for(const [from, edges] of other.edgeInformation) {
      for(const [to, edge] of edges) {
        this.addEdge(from, to, edge)
      }
    }
  }
}

export interface ControlFlowInformation extends MergeableRecord {
  returns:     NodeId[],
  breaks:      NodeId[],
  continues:   NodeId[],
  exitPoints:  NodeId[],
  entryPoints: NodeId[],
  graph:     CFG
}


const cfgFolds: FoldFunctions<ParentInformation, ControlFlowInformation> = {
  foldNumber:  cfgLeaf,
  foldString:  cfgLeaf,
  foldLogical: cfgLeaf,
  foldSymbol:  cfgLeaf,
  foldAccess:  cfgLeaf /* TODO */,
  binaryOp:    {
    foldLogicalOp:    cfgLeaf /* TODO */,
    foldArithmeticOp: cfgLeaf /* TODO */,
    foldComparisonOp: cfgLeaf /* TODO */,
    foldAssignment:   cfgLeaf /* TODO */,
    foldPipe:         cfgLeaf /* TODO */,
    foldModelFormula: cfgLeaf /* TODO */
  },
  unaryOp: {
    foldArithmeticOp: cfgLeaf /* TODO */,
    foldLogicalOp:    cfgLeaf /* TODO */,
    foldModelFormula: cfgLeaf /* TODO */
  },
  other: {
    foldComment:       cfgLeaf,
    foldLineDirective: cfgLeaf
  },
  loop: {
    foldFor:    cfgLeaf /* TODO */,
    foldRepeat: cfgLeaf /* TODO */,
    foldWhile:  cfgLeaf /* TODO */,
    foldBreak:  cfgLeaf /* TODO: cfg jump links */ ,
    foldNext:   cfgLeaf /* TODO: cfg jump links */
  },
  foldIfThenElse: cfgLeaf /* TODO */,
  foldExprList:   cfgExprList,
  functions:      {
    foldFunctionDefinition: cfgLeaf /* TODO */,
    foldFunctionCall:       cfgLeaf /* TODO; CFG: jump links for return */,
    foldParameter:          cfgLeaf /* TODO */,
    foldArgument:           cfgLeaf /* TODO */
  }
}

export function extractCFG<Info=ParentInformation>(ast: NormalizedAst<Info>): ControlFlowInformation {
  return foldAst(ast.ast, cfgFolds)
}


function getLexeme(n: RNodeWithParent) {
  return n.info.fullLexeme ?? n.lexeme ?? ''
}

function cfgLeaf(leaf: RNodeWithParent): ControlFlowInformation {
  const graph = new CFG()
  graph.addNode({ id: leaf.info.id, name: leaf.type, content: getLexeme(leaf), children: [] })
  return { graph, breaks: [], continues: [], returns: [], exitPoints: [leaf.info.id], entryPoints: [leaf.info.id] }
}

function cfgExprList(node: RNodeWithParent, expressions: ControlFlowInformation[]) {
  // TODO: move exit and entry into the graph
  const result: ControlFlowInformation = { graph: new CFG(), breaks: [], continues: [], returns: [], entryPoints: [], exitPoints: [] }
  let first = true
  for(const expression of expressions) {
    // TODO: deal with loops?
    if(first) {
      result.entryPoints = expression.entryPoints
      first = false
    } else {
      for(const previousExitPoint of result.exitPoints) {
        for(const entryPoint of expression.entryPoints) {
          result.graph.addEdge(entryPoint, previousExitPoint, { label: 'CD' })
        }
      }
    }
    result.graph.merge(expression.graph)
    result.breaks.push(...expression.breaks)
    result.continues.push(...expression.continues)
    result.returns.push(...expression.returns)
    result.exitPoints = expression.exitPoints
  }
  return result
}
