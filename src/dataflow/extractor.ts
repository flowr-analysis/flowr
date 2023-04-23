import { log } from '../util/log'
import { BiMap } from '../util/bimap'
import { type Id, type IdType } from './id'
import { foldAst } from '../r-bridge/lang:4.x/ast/fold'
import { RNa, RNull } from '../r-bridge/lang:4.x/values'
import type * as Lang from '../r-bridge/lang:4.x/ast/model'
import { type ParentInformation, type RNodeWithParent } from './parents'
import { guard } from '../util/assert'
import {
  addEdge,
  DataflowGraph, DataflowGraphEdge,
  DataflowGraphEdgeAttribute,
  DataflowGraphEdgeType, DataflowGraphNode,
  DataflowScopeName,
  GLOBAL_SCOPE, LOCAL_SCOPE, mergeDataflowGraphs
} from './graph'
import {MergeableRecord} from "../util/objects"
import {RNode} from "../r-bridge/lang:4.x/ast/model"

const dataflowLogger = log.getSubLogger({ name: 'ast' })

export type DataflowRNode<OtherInfo> = Lang.RSymbol<OtherInfo & Id & ParentInformation>

/**
 * The basic dataflow algorithm will work like this: [TODO: extend :D]
 * Every node produces a dataflow graph, higher operations will merge the graphs together
 */

/** used to get an entry point for every id, after that it allows reference-chasing of the graph */
export type DataflowMap<OtherInfo> = BiMap<IdType, RNodeWithParent<OtherInfo>>

interface FoldReadWriteTargetBase {
  attribute: DataflowGraphEdgeAttribute
}

interface FoldReadWriteTargetAlways extends FoldReadWriteTargetBase {
  attribute: 'always',
  id:        IdType
}

interface FoldReadWriteTargetMaybe extends FoldReadWriteTargetBase {
  attribute: 'maybe',
  ids:       IdType[]
}

type FoldReadWriteTarget = FoldReadWriteTargetAlways | FoldReadWriteTargetMaybe

/**
 * during folding we consider each fold-step as a single block (e.g., a variable, a assignment, a function expression, ...)
 * for each we hold a set of information (in(block), out(block) and unclassified references) as well as the currently produced
 * dataflow graph.
 * <p>
 * These graphs will be combined using {@link #mergeDataflowGraphs} to incrementally produce the final dataflow graph.
 */
interface FoldInfo {
  /** variable names that have been used without clear indication of their origin (i.e. if they will be read or written to) */
  activeNodes: IdType[]
  /** variables that have been read in the current block (i.e., in(block))*/
  in:          IdType[] // TODO: read from env?
  /** variables that have been written to the given scope (i.e., out(block)) */
  out:         Map<DataflowScopeName, FoldReadWriteTarget[]>
  /** the complete dataflow graph produced by the current block */
  graph:       DataflowGraph
}

/** represents a block with all elements set to their monoid-empty values */
function emptyFoldInfo (): FoldInfo {
  return {
    activeNodes: [],
    in:          [],
    out:         new Map(),
    graph:       {
      nodes: [],
      edges: new Map()
    }
  }
}

// TODO: we could add these leafs in the future to get more information about constants etc?
function processUninterestingLeaf<OtherInfo> (leaf: RNodeWithParent<OtherInfo>): FoldInfo {
  return emptyFoldInfo()
}

// TODO: is out parameter info the best choice? or should i remain with a closure? i wanted to reduce nesting
function processSymbol<OtherInfo> (dataflowIdMap: DataflowMap<OtherInfo>): (symbol: DataflowRNode<OtherInfo>) => FoldInfo {
  // TODO: are there other built-ins?
  return symbol => {
    if (symbol.content === RNull || symbol.content === RNa) {
      return emptyFoldInfo()
    }
    // TODO: can be replaced by id set if we have a mapping with ids on the parented nodes
    dataflowIdMap.set(symbol.id, symbol)
    const node: DataflowGraphNode = {
      id:   symbol.id,
      name: symbol.content
    }
    return {
      activeNodes: [symbol.id],
      in:          [],
      out:         new Map(),
      graph:       {
        nodes: [node],
        edges: new Map()
      }
    }
  }
}

function processNonAssignmentBinaryOp<OtherInfo> (op: RNodeWithParent<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo): FoldInfo {
  // TODO: produce special edges
  // TODO: fix merge of map etc.
  return {
    activeNodes: [], // binary ops require reads as wihtout assignments there is no definition
    in:          [...lhs.in, ...rhs.in, ...lhs.activeNodes, ...rhs.activeNodes],
    // todo: there must be a more effective way than creating all of those new maps and arrays etc.
    out:         new Map([...lhs.out, ...rhs.out]),
    // TODO: insert a join node?
    graph:       mergeDataflowGraphs(lhs.graph, rhs.graph)
  }
}


function identifyReadAndWriteBasedOnOp<OtherInfo>(op: RNodeWithParent<OtherInfo>, rhs: FoldInfo, lhs: FoldInfo) {
  const read = [...lhs.in, ...rhs.in]
  const write = [...lhs.out, ...rhs.out]

  let source
  let target
  let global = false

  switch (op.lexeme) {
    case '<-':
      [target, source] = [lhs, rhs]
      break
    case '<<-':
      [target, source, global] = [lhs, rhs, true]
      break
    case '=': // TODO: special
      [target, source] = [lhs, rhs]
      break
    case '->':
      [target, source] = [rhs, lhs]
      break
    case '->>':
      [target, source, global] = [rhs, lhs, true]
      break
    default:
      throw new Error(`Unknown assignment operator ${JSON.stringify(op)}`)
  }
  const writeNodes = new Map<string, FoldReadWriteTarget[]>(
    [...target.activeNodes].map(id => [global ? GLOBAL_SCOPE : LOCAL_SCOPE, [{attribute: 'always', id}]]))
  return {readTargets: [...source.activeNodes, ...read], writeTargets: new Map<string, FoldReadWriteTarget[]> ([...writeNodes, ...write])}
}

// TODO: nested assignments like x <- y <- z <- 1
function processAssignment<OtherInfo> (op: RNodeWithParent<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo): FoldInfo {
  const { readTargets, writeTargets } = identifyReadAndWriteBasedOnOp(op,  rhs, lhs)
  const nextGraph = mergeDataflowGraphs(lhs.graph, rhs.graph)
  // TODO: identify global, local etc.
  for (const [, writeTarget] of writeTargets) {
    for (const t of writeTarget) {
      const ids = t.attribute === 'always' ? [t.id] : t.ids
      for(const writeId of ids) {
        for (const readId of readTargets) {
          addEdge(nextGraph, writeId, readId, 'defined-by', 'always')
        }
      }
    }
  }
  // TODO URGENT: keep write to
  return {
    activeNodes: [],
    in:          readTargets,
    out:         writeTargets,
    graph:       nextGraph
  }
}

// TODO: potential dataflow with both branches!
function processIfThenElse<OtherInfo> (ifThen: RNodeWithParent<OtherInfo>, cond: FoldInfo, then: FoldInfo, otherwise?: FoldInfo): FoldInfo {
  // TODO: allow to also attribute in-put with amybe and always
  const ingoing = [...cond.in, ...then.in, ...(otherwise?.in ?? [])]

  // we assign all with a maybe marker
  const outgoing = new Map([...cond.out])

  for(const [scope, targets] of then.out) {
    const existing = outgoing.get(scope)
    const existingIds = existing?.flatMap(t => t.attribute === 'always' ? [t.id] : t.ids) ?? []
    outgoing.set(scope, targets.map(t => {
      if(t.attribute === 'always') {
        return {attribute: 'maybe', ids: [t.id, ...existingIds]}
      } else {
        return t
      }
    }))
  }


  return {
    activeNodes: [...cond.activeNodes, ...then.activeNodes, ...(otherwise?.activeNodes ?? [])],
    in:          ingoing,
    out:         outgoing,
    graph:       mergeDataflowGraphs(cond.graph, then.graph, otherwise?.graph)
  }
}

// TODO: instead of maybe use nested if-then path possibilities for abstract interpretation?
type WritePointerTargets = { type: 'always', id: IdType } | { type: 'maybe', ids: IdType[] }
type WritePointers = Map<IdType, WritePointerTargets>

// TODO: test
function updateAllWriteTargets<OtherInfo> (currentChild: FoldInfo, dataflowIdMap: DataflowMap<OtherInfo>, writePointers: WritePointers): void {
  for (const [, writeTargets] of currentChild.out) {
    for (const writeTarget of writeTargets) {
      const writeTargetIds = writeTarget.attribute === 'always' ? [writeTarget.id] : writeTarget.ids
      for (const writeTargetId of writeTargetIds) {
        const mustHaveTarget = dataflowIdMap.get(writeTargetId)
        guard(mustHaveTarget !== undefined, `Could not find target for ${JSON.stringify(writeTarget)}`)
        const writeName = mustHaveTarget.lexeme
        guard(writeName !== undefined, `${JSON.stringify(writeTarget)} does not have an attached writeName`)
        // TODO: hide in merge - monoid!

        const previousValue = writePointers.get(writeName)
        if (writeTarget.attribute === 'always' && previousValue?.type !== 'maybe') { // add it as an always
          writePointers.set(writeName, {
            type: 'always',
            id:   writeTarget.id
          })
        } else {
          let newTargets
          if (previousValue?.type === 'always') {
            newTargets = [previousValue.id, ...writeTargetIds]
          } else {
            newTargets = [...(previousValue?.ids ?? []), ...writeTargetIds]
          }
          writePointers.set(writeName, {
            type: 'maybe',
            ids:  newTargets
          })
        }
      }
    }
  }
}


// TODO: we have to change that within quoted-expressions! and parse/deparse?
function processExprList<OtherInfo> (dataflowIdMap: DataflowMap<OtherInfo>): (exprList: RNodeWithParent<OtherInfo>, children: FoldInfo[]) => FoldInfo {
  // TODO: deal with information in order + scoping when we have functions
  // we assume same scope for local currently, yet we return local writes too, as a simple exprList does not act as scoping block
  // link a given name to IdTypes
  return (exprList, children) => {
    // TODO: keep scope for writePointers
    const writePointers = new Map<string, WritePointerTargets>()
    const remainingRead =  new Map<string, IdType[]>() // name to id

    // TODO: this is definitely wrong
    const nextGraph = mergeDataflowGraphs(...children.map(child => child.graph))

    for (const element of children) {
      const currentElement: FoldInfo = element

      for (const readId of currentElement.in) {
        const existingRef = dataflowIdMap.get(readId)
        const readName = existingRef?.lexeme
        guard (readName !== undefined, `Could not find name for read variable ${readId}`)

        const probableTarget = writePointers.get(readName)
        console.log("searching", readName, probableTarget)
        if (probableTarget === undefined) {
          // keep it, for we have no target, as read-ids are unique within same fold, this should work for same links
          if(remainingRead.has(readName)) {
            remainingRead.get(readName)?.push(readId)
          } else {
            remainingRead.set(readName, [readId])
          }
        } else if (probableTarget.type === 'always') {
          addEdge(nextGraph, readId, probableTarget.id, 'read', 'always')
        } else {
          for (const target of probableTarget.ids) {
            addEdge(nextGraph, readId, target, 'read', 'maybe')
          }
        }
      }
      // add same variable reads for deferd if they are read previously but not dependent
      // TODO: deal with globals etc.
      for (const [, writeTargets] of currentElement.out) {
        for(const writeTarget of writeTargets) {
          const writeTargetIds = writeTarget.attribute === 'always' ? [writeTarget.id] : writeTarget.ids
          for (const writeId of writeTargetIds) {

            const existingRef = dataflowIdMap.get(writeId)
            const writeName = existingRef?.lexeme
            guard(writeName !== undefined, `Could not find name for write variable ${writeId}`)
            console.log('writeName', writeName, remainingRead)
            if (remainingRead.has(writeName)) {
              const readIds = remainingRead.get(writeName)
              guard(readIds !== undefined, `Could not find readId for write variable ${writeId}`)
              for (const readId of readIds) {
                addEdge(nextGraph, readId, writeId, 'same-read-read', 'always')
              }
            } else if (writePointers.has(writeName)) { // write-write
              const writePointer = writePointers.get(writeName)
              guard(writePointer !== undefined, `Could not find writePointer for write variable ${writeId}`)
              if (writePointer.type === 'always') {
                addEdge(nextGraph, writePointer.id, writeId, 'same-def-def', 'always')
              } else {
                for (const target of writePointer.ids) {
                  addEdge(nextGraph, target, writeId, 'same-def-def', 'always')
                }
              }
            }
          }
        }
      }


      // for each variable read add the closest write and if we have one, remove it from read
      updateAllWriteTargets(currentElement, dataflowIdMap, writePointers)
    }
    return {
      // TODO: ensure active killed on that level?
      activeNodes: children.flatMap(child => child.activeNodes),
      in:          [...remainingRead.values()].flatMap(i => i),
      out:         new Map(children.flatMap(child => [...child.out])),
      graph:       nextGraph
    }
  }
}

export interface DataflowInformation<OtherInfo> {
  dataflowIdMap: DataflowMap<OtherInfo> // TODO: migrate if ids moved to parents
  dataflowGraph: DataflowGraph
}

export function produceDataFlowGraph<OtherInfo> (ast: RNodeWithParent<OtherInfo>): DataflowInformation<OtherInfo> {
  const dataflowIdMap = new BiMap<IdType, RNodeWithParent<OtherInfo>>()


  const foldResult = foldAst<OtherInfo & Id & ParentInformation, FoldInfo>(ast, {
    foldNumber:  processUninterestingLeaf,
    foldString:  processUninterestingLeaf,
    foldLogical: processUninterestingLeaf,
    foldSymbol:  processSymbol(dataflowIdMap),
    binaryOp:    {
      foldLogicalOp:    processNonAssignmentBinaryOp,
      foldArithmeticOp: processNonAssignmentBinaryOp,
      foldComparisonOp: processNonAssignmentBinaryOp,
      // TODO: deal with assignments
      foldAssignment:   processAssignment
    },
    foldIfThenElse: processIfThenElse,
    foldExprList:   processExprList(dataflowIdMap)
  })

  // TODO: process
  dataflowLogger.warn(`remaining actives: ${JSON.stringify(foldResult)}`)

  // TODO: implement
  return { dataflowIdMap, dataflowGraph: foldResult.graph }
}
