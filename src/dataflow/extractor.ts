import {
  type RAssignmentOp, type RBinaryOp, type RExprList, type RIfThenElse,
  type RLogical,
  type RNode,
  type RNumber,
  type RString,
  type RSymbol
} from '../r-bridge/lang:4.x/ast/model'
import { foldAST } from '../r-bridge/lang:4.x/ast/fold'
import { RNa, RNull } from '../r-bridge/lang:4.x/values'
import { isNotUndefined } from '../util/assert'
import { log } from '../util/log'
import { BiMap } from '../util/bimap'

const dataflowLogger = log.getSubLogger({ name: 'ast' })

/**
 * The basic dataflow algorithm will work like this:
 * Folding the ast from the leaves up it will perform the following actions (and nothing for all other nodes):
 * - for every variable usage it will create a node in the dataflow graph and add it to the active set
 * - if it encounters a definition, all targeted variables will be tagged with the corresponding definition operator form {@link Assignments}
 * TODO:
 *
 */

/** uniquely identifies a node within an AST */
export type DataflowId = string

export interface DataflowInfo {
  id: DataflowId
  // TODO: more definition information
  definedBy?: DataflowId
}

// TODO: additional & is dirty type fix?
export type DataflowNode<OtherInfo> = RNode<OtherInfo & { dataflow: DataflowInfo }> & { info: { dataflow: DataflowInfo } }

// used to get an entry point for every id, after that it allows reference-chasing of the graph
export type DataflowMap<OtherInfo> = BiMap<DataflowId, DataflowNode<OtherInfo>>

// TODO: improve on the graph
// TODO: deal with overshadowing, same names etc.

/**
 * holds the dataflow information found within the given AST
 * there is a node for every variable encountered, obeying scoping rules
 * TODO: additional information for edges
 */
export interface DataflowGraph {
  nodes: Array<{
    id: DataflowId
    name: string
  }>
  edges: Map<DataflowId, DataflowId[]>
}

export function decorateWithDataFlowInfo<OtherInfo>(ast: RNode<OtherInfo>): {
  decoratedAst: DataflowNode<OtherInfo>
  dataflowIdMap: DataflowMap<OtherInfo>
  dataflowGraph: DataflowGraph
} {
  // active contains the list of read/written to variables atm
  interface FoldInfo {
    data: DataflowNode<OtherInfo>
    active: {
      read: DataflowId[]
      write: DataflowId[]
    }
  }

  const dataflowIdMap = new BiMap<DataflowId, DataflowNode<OtherInfo>>()

  const dataflowGraph: DataflowGraph = {
    nodes: [],
    edges: new Map<DataflowId, DataflowId[]>() // TODO: default map?
  }

  // TODO: symbol map, improve symbol generation
  let currentId = 0
  const retrieveId = (node: RNode<OtherInfo>, usageOfVariable = false): FoldInfo => {
    // TODO: const existing = dataflowIdMap.getKey(node)
    currentId++ // todo: find a better way?
    const newNode = { ...node, info: { dataflow: { id: currentId.toString() } } }
    const id = currentId.toString()
    dataflowIdMap.set(id, newNode)
    return { data: newNode, active: { read: usageOfVariable ? [id] : [], write: [] } }
  }

  // TODO: outsource?
  const mergeActives = (...actives: Array<undefined | FoldInfo['active']>): FoldInfo['active'] => {
    const read = actives.flatMap(active => active?.read).filter(isNotUndefined)
    const write = actives.flatMap(active => active?.write).filter(isNotUndefined)
    return { read, write }
  }

  const foldNumber = (num: RNumber<OtherInfo>): FoldInfo => retrieveId(num)
  const foldString = (str: RString<OtherInfo>): FoldInfo => retrieveId(str)
  const foldLogical = (logical: RLogical<OtherInfo>): FoldInfo => retrieveId(logical)
  const foldSymbol = (symbol: RSymbol<OtherInfo>): FoldInfo => {
    // TODO: detect built-in
    if (symbol.content === RNull || symbol.content === RNa) {
      return retrieveId(symbol)
    } else {
      const node = retrieveId(symbol, true)
      dataflowGraph.nodes.push({ id: node.data.info.dataflow.id, name: node.data.lexeme ?? '<unknown>' })
      return node
    }
  }

  const foldLogicalOp = (op: RBinaryOp<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo): FoldInfo => {
    const newOp = retrieveId(op)
    // keep all actives for different ids until they are assigned/written to (TODO: function parameters)
    newOp.data.lhs = lhs.data
    newOp.data.rhs = rhs.data
    return { data: newOp.data, active: mergeActives(newOp.active, lhs.active, rhs.active) }
  }

  // TODO: edge type and changed edge-types?
  const foldArithmeticOp = foldLogicalOp
  const foldComparisonOp = foldLogicalOp

  const foldAssignment = (op: RAssignmentOp<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo): FoldInfo => {
    const newOp = retrieveId(op, true)
    newOp.data.lhs = lhs.data
    newOp.data.rhs = rhs.data

    // TODO: ensure that it is only one symbol on lhs or rhs
    // TODO: global assignments in scope
    // TODO: FIX for both sides (+eq_assignment) !
    if (op.op === '<-') {
      dataflowLogger.info(`encountered local assignment for ${lhs.data.lexeme ?? '<unknown>'}
        * lhs active: ${JSON.stringify(lhs.active)}
        * rhs active: ${JSON.stringify(rhs.active)}`
      )
      // for a local assignment we can add the edge directly and clear the write list (TODO: validate)
      const write = newOp.data.info.dataflow.id
      const read = rhs.active.read
      if (write !== undefined) {
        dataflowGraph.edges.set(write, read)
        newOp.active.write = [write]
      }
    } else if (op.op === '<<-') {
      console.error('encountered global assignment, now unsupported')
    }

    return { data: newOp.data, active: mergeActives(newOp.active, lhs.active, rhs.active) }
  }

  const foldIfThenElse = (ifThen: RIfThenElse<OtherInfo>, condition: FoldInfo, then: FoldInfo, otherwise?: FoldInfo): FoldInfo => {
    // TODO: use ifTHen
    /* no scoping for if */
    condition.data.then = then.data
    condition.data.otherwise = otherwise?.data
    return { data: condition.data, active: mergeActives(condition.active, then.active, otherwise?.active) }
  }

  const foldExprList = (exprList: RExprList<OtherInfo>, expressions: FoldInfo[]): FoldInfo => {
    const newExprList = retrieveId(exprList)
    newExprList.data.children = expressions.map(exp => exp.data)
    // TODO: this is wrong, make read-def chains in order of appearance
    return { data: newExprList.data, active: mergeActives(newExprList.active, ...expressions.map(e => e.active)) }
  }

  const foldResult = foldAST<OtherInfo, FoldInfo>(ast, {
    foldNumber,
    foldString,
    foldLogical,
    foldSymbol,
    binaryOp: {
      foldLogicalOp,
      foldArithmeticOp,
      foldComparisonOp,
      foldAssignment
    },
    foldIfThenElse,
    foldExprList
  })

  // log.info('dataflowIdMap', dataflowIdMap)
  return {
    decoratedAst: foldResult.data,
    dataflowGraph,
    dataflowIdMap
  }
}
