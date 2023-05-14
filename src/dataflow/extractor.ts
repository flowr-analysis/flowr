import { log } from "../util/log"
import { BiMap } from "../util/bimap"
import { type Id, type IdType } from "./id"
import { foldAst, RAssignmentOp, RNa, RNull, RSymbol } from '../r-bridge'
import { type ParentInformation, type RNodeWithParent } from "./parents"
import { guard } from "../util/assert"
import {
  DataflowGraph,
  DataflowGraphEdgeAttribute,
  DataflowScopeName,
  GlobalScope,
  LocalScope,
} from "./graph"
import { DefaultMap } from "../util/defaultmap"

const dataflowLogger = log.getSubLogger({ name: "ast" })

export type DataflowRNode<OtherInfo> = RSymbol<OtherInfo & Id & ParentInformation> & { info: OtherInfo & Id & ParentInformation }

/**
 * The basic dataflow algorithm will work like this: [TODO: extend :D]
 * Every node produces a dataflow graph, higher operations will merge the graphs together
 */

/** used to get an entry point for every id, after that it allows reference-chasing of the graph */
export type DataflowMap<OtherInfo> = BiMap<IdType, RNodeWithParent<OtherInfo>>

interface FoldWriteTargetBase {
  attribute: DataflowGraphEdgeAttribute
}

interface FoldWriteTargetAlways extends FoldWriteTargetBase {
  attribute: 'always',
  id:        IdType
}

interface FoldWriteTargetMaybe extends FoldWriteTargetBase {
  attribute: 'maybe',
  ids:       IdType[]
}

type FoldWriteTarget = FoldWriteTargetAlways | FoldWriteTargetMaybe
interface FoldReadTarget { id: IdType, attribute: DataflowGraphEdgeAttribute }

/**
 * during folding we consider each fold-step as a single block (e.g., a variable, a assignment, a function expression, ...)
 * for each we hold a set of information (in(block), out(block) and unclassified references) as well as the currently produced
 * dataflow graph.
 * <p>
 * These graphs will be combined using {@link DataflowGraph#mergeWith} to incrementally produce the final dataflow graph.
 */
interface FoldInfo {
  /** variable names that have been used without clear indication of their origin (i.e. if they will be read or written to) */
  activeNodes: FoldReadTarget[]
  /** variables that have been read in the current block (i.e., in(block))*/
  in:          FoldReadTarget[] // TODO: read from env?
  /** variables that have been written to the given scope (i.e., out(block)) */
  out:         Map<DataflowScopeName, FoldWriteTarget[]>
  /** the complete dataflow graph produced by the current block */
  graph:       DataflowGraph
}

/** represents a block with all elements set to their monoid-empty values */
function emptyFoldInfo(): FoldInfo {
  return {
    activeNodes: [],
    in:          [],
    out:         new Map(),
    graph:       new DataflowGraph()
  }
}

// TODO: we could add these leafs in the future to get more information about constants etc?
function processUninterestingLeaf(_leaf: unknown): FoldInfo {
  return emptyFoldInfo()
}

// TODO: is out parameter info the best choice? or should i remain with a closure? i wanted to reduce nesting
function processSymbol<OtherInfo>(dataflowIdMap: DataflowMap<OtherInfo>): (symbol: RSymbol<OtherInfo & Id & ParentInformation>) => FoldInfo {
  // TODO: are there other built-ins?
  return symbol => {
    if (symbol.content === RNull || symbol.content === RNa) {
      return emptyFoldInfo()
    }
    // TODO: can be replaced by id set if we have a mapping with ids on the parented nodes
    dataflowIdMap.set(symbol.info?.id as IdType, symbol as RNodeWithParent<OtherInfo>)
    return {
      activeNodes: [{ attribute: 'always', id: symbol.info?.id as IdType }],
      in:          [],
      out:         new Map(),
      graph:       new DataflowGraph().addNode(symbol.info?.id as IdType, symbol.content)
    }
  }
}

function processNonAssignmentBinaryOp(op: unknown, lhs: FoldInfo, rhs: FoldInfo): FoldInfo {
  // TODO: produce special edges
  // TODO: fix merge of map etc.
  const ingoing = [...lhs.in, ...rhs.in, ...lhs.activeNodes, ...rhs.activeNodes]
  const nextGraph = lhs.graph.mergeWith(rhs.graph)
  linkIngoingVariablesInSameScope(nextGraph, ingoing)

  return {
    activeNodes: [], // binary ops require reads as without assignments there is no definition
    in:          ingoing,
    out:         new Map([...lhs.out, ...rhs.out]),
    // TODO: insert a join node?
    graph:       nextGraph
  }
}

function processUnaryOp(op: unknown, operand: FoldInfo): FoldInfo {
  // TODO: really pass through?
  return {
    activeNodes: operand.activeNodes,
    in:          operand.in,
    out:         operand.out,
    graph:       operand.graph
  }
}

function produceNameSharedIdMap(idPool: FoldReadTarget[], graph: DataflowGraph): DefaultMap<string, FoldReadTarget[]> {
  const nameIdShares = new DefaultMap<string, FoldReadTarget[]>(() => [])
  idPool.forEach(id => {
    const name = graph.get(id.id)?.name
    guard(name !== undefined, `name must be defined for ${JSON.stringify(id)}`)
    const previous = nameIdShares.get(name)
    previous.push(id)
  })
  return nameIdShares
}

function linkReadVariablesInSameScopeWithNames(graph: DataflowGraph, nameIdShares: DefaultMap<string, FoldReadTarget[]>) {
  for (const ids of nameIdShares.values()) {
    if (ids.length <= 1) {
      continue
    }
    const base = ids[0]
    for (let i = 1; i < ids.length; i++) {
      // TODO: include the attribute? probably not, as same-edges are independent of structure
      graph.addEdge(base.id, ids[i].id, 'same-read-read', 'always')
    }
  }
}

/** does not connect fully but only link so that all are connected, updates teh graph in-place */
function linkIngoingVariablesInSameScope(graph: DataflowGraph, idPool: FoldReadTarget[]): void {
  const nameIdShares = produceNameSharedIdMap(idPool, graph)
  linkReadVariablesInSameScopeWithNames(graph, nameIdShares)
}

function setDefinitionOfNode(graph: DataflowGraph, id: IdType, scope: DataflowScopeName): void {
  const node = graph.get(id)
  guard(node !== undefined, `node must be defined for ${id} to set definition scope to ${scope}`)
  guard(node.definedAtPosition === false || node.definedAtPosition === scope, `node must not be previously defined at position or have same scope for ${id} to set definition scope to ${scope}`)
  node.definedAtPosition = scope
}


function identifyReadAndWriteForAssignmentBasedOnOp<OtherInfo>(op: RNodeWithParent<OtherInfo>, rhs: FoldInfo, lhs: FoldInfo) {
  // what is written/read additionally is based on lhs/rhs - assignments read written variables as well
  const read = [...lhs.in, ...rhs.in]

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
  const writeNodes = new Map<string, FoldWriteTarget[]>(
    [...target.activeNodes].map(id => [
      global ? GlobalScope : LocalScope,
      // TODO: use id.attribute?
      [{attribute: 'always', id: id.id}]
    ]))
  const readFromSourceWritten: FoldReadTarget[] = [...source.out].flatMap(([scope,targets]): FoldReadTarget[] => {
    guard(scope === LocalScope, 'currently, nested write re-assignments are only supported for local')
    return targets.map(id => {
      guard(id.attribute === 'always', 'currently, nested write re-assignments are only supported for always')
      return id
    })
  })
  return {readTargets: [...source.activeNodes, ...read, ...readFromSourceWritten], writeTargets: new Map<string, FoldWriteTarget[]> ([...writeNodes, ...target.out])}
}

function processAssignment<OtherInfo>(op: RAssignmentOp<OtherInfo & Id & ParentInformation>, lhs: FoldInfo, rhs: FoldInfo): FoldInfo {
  const { readTargets, writeTargets } = identifyReadAndWriteForAssignmentBasedOnOp(op as RNodeWithParent<OtherInfo>,  rhs, lhs)
  const nextGraph = lhs.graph.mergeWith(rhs.graph)
  // TODO: identify global, local etc.
  for (const [scope, writeTarget] of writeTargets) {
    for (const t of writeTarget) {
      const ids = t.attribute === 'always' ? [t.id] : t.ids
      for(const writeId of ids) {
        setDefinitionOfNode(nextGraph, writeId, scope)
        for(const readTarget of readTargets) {
          nextGraph.addEdge(writeId, readTarget.id, 'defined-by', readTarget.attribute)
        }
      }
    }
  }
  return {
    activeNodes: [],
    in:          readTargets,
    out:         writeTargets,
    graph:       nextGraph
  }
}

function makeFoldReadTargetsMaybe(ids: FoldReadTarget[]): FoldReadTarget[] {
  return ids.map(id => ({ attribute: 'maybe', id: id.id}))
}

function processIfThenElse(ifThen: unknown, cond: FoldInfo, then: FoldInfo, otherwise?: FoldInfo): FoldInfo {
  // TODO: allow to also attribute in-put with maybe and always
  // again within an if-then-else we consider all actives to be read
  const ingoing: FoldReadTarget[] = [...cond.in, ...makeFoldReadTargetsMaybe(then.in),
    ...makeFoldReadTargetsMaybe(otherwise?.in ?? []), ...cond.activeNodes,
    ...makeFoldReadTargetsMaybe(then.activeNodes), ...makeFoldReadTargetsMaybe(otherwise?.activeNodes ?? [])
  ]

  // we assign all with a maybe marker
  const outgoing = new Map([...cond.out])

  // we do not merge even if they appear in both branches because the maybe links will refer to different ids
  for(const [scope, targets] of [...then.out, ...(otherwise?.out ?? [])]) {
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

  const nextGraph = cond.graph.mergeWith(then.graph, otherwise?.graph)
  linkIngoingVariablesInSameScope(nextGraph, ingoing)
  // TODO: join def-def?


  return {
    activeNodes: [],
    in:          ingoing,
    out:         outgoing,
    graph:       nextGraph
  }
}

function processForLoop(loop: unknown, variable: FoldInfo, vector: FoldInfo, body: FoldInfo): FoldInfo {

  // TODO: allow to also attribute in-put with maybe and always
  // again within an if-then-else we consider all actives to be read
  // TODO: deal with ...variable.in it is not really ingoing in the sense of bindings i against it, but it should be for the for-loop
  // currently i add it at the end, but is this correct?
  const ingoing = [...vector.in, ...body.in, ...vector.activeNodes, ...body.activeNodes]

  // we assign all with a maybe marker

  // TODO: use attribute?
  const writtenVariable: [[DataflowScopeName, FoldWriteTarget[]]] = [[LocalScope, variable.activeNodes.map(id => ({attribute: 'always', id: id.id}))]]
  const nextGraph = variable.graph.mergeWith(vector.graph, body.graph)

  // TODO: hold name when reading to avoid constant indirection?
  // now we have to bind all open reads with the given name to the locally defined writtenVariable!
  // TODO: assert target name? (should be the correct way to do)
  const nameIdShares = produceNameSharedIdMap(ingoing, nextGraph)

  for(const [scope, targets] of writtenVariable) {
    for(const target of targets) {
      const ids = target.attribute === 'always' ? [target.id] : target.ids
      for(const id of ids) {
        // define it in term of all vector.in and vector.activeNodes
        // TODO: do not re-join every time!
        for(const link of [...vector.in, ...vector.activeNodes]) {
          nextGraph.addEdge(id, link.id, 'defined-by', link.attribute)
        }

        const name = nextGraph.get(id)?.name
        guard(name !== undefined, `name should be defined for node ${id}`)
        const readIdsToLink = nameIdShares.get(name)
        for(const readId of readIdsToLink) {
          nextGraph.addEdge(readId.id, id, 'defined-by', readId.attribute)
        }
        // now, we remove the name from the id shares as they are no longer needed
        nameIdShares.delete(name)
        setDefinitionOfNode(nextGraph, id, scope)
      }
    }
  }

  const outgoing = new Map([...variable.out, ...writtenVariable])

  for(const [scope, targets] of body.out) {
    const existing = outgoing.get(scope)
    const existingIds = existing?.flatMap(t => t.attribute === 'always' ? [t.id] : t.ids) ?? []
    outgoing.set(scope, targets.map(t => {
      if(t.attribute === 'always') {
        // maybe due to loop which does not have to execute!
        return {attribute: 'maybe', ids: [t.id, ...existingIds]}
      } else {
        return t
      }
    }))
  }

  // TODO: scoping?
  linkIngoingVariablesInSameScope(nextGraph, ingoing)

  return {
    activeNodes: [],
    // we only want those not bound by a local variable
    in:          [...variable.in, ...[...nameIdShares.values()].flatMap(v => v)],
    out:         outgoing,
    graph:       nextGraph
  }
}

function processRepeatLoop(loop: unknown, body: FoldInfo): FoldInfo {
  // TODO
  return {
    activeNodes: [],
    in:          [...body.in, ...body.activeNodes.map(id => ({attribute: 'maybe' as const, id: id.id}))],
    out:         body.out,
    graph:       body.graph
  }
}

function processWhileLoop(loop: unknown, condition: FoldInfo, body: FoldInfo): FoldInfo {
  // TODO
  return {
    activeNodes: [],
    in:          [...condition.in, ...body.in, ...condition.activeNodes, ...body.activeNodes.map(id => ({attribute: 'maybe' as const, id: id.id}))],
    out:         new Map([...body.out, ...condition.out]), // todo: merge etc.
    graph:       condition.graph.mergeWith(body.graph)
  }
}


// TODO: instead of maybe use nested if-then path possibilities for abstract interpretation?
type WritePointerTargets = { type: 'always', id: IdType } | { type: 'maybe', ids: IdType[] }
type WritePointers = Map<IdType, WritePointerTargets>

// TODO: test
function updateAllWriteTargets<OtherInfo>(currentChild: FoldInfo, dataflowIdMap: DataflowMap<OtherInfo>, writePointers: WritePointers): void {
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


function processFunctionCall(functionCall: unknown, functionName: FoldInfo,  parameters: FoldInfo[]): FoldInfo {
  // TODO: deal with function info
  // TODO rest
  return {
    activeNodes: [],
    in:          parameters.map(p => [...p.in, ...p.activeNodes]).flatMap(v => v),
    out:         new Map(parameters.map(p => [...p.out]).flatMap(v => v)),
    graph:       parameters.length === 0 ? new DataflowGraph() : parameters[0].graph.mergeWith(...parameters.slice(1).map(p => p.graph))
  }
}

// TODO: we have to change that within quoted-expressions! and parse/de-parse?
function processExprList<OtherInfo>(dataflowIdMap: DataflowMap<OtherInfo>): (exprList: unknown, children: FoldInfo[]) => FoldInfo {
  // TODO: deal with information in order + scoping when we have functions
  // we assume same scope for local currently, yet we return local writes too, as a simple exprList does not act as scoping block
  // link a given name to IdTypes
  return (exprList, children) => {
    if(children.length === 0) {
      return emptyFoldInfo()
    }

    // TODO: keep scope for writePointers
    const writePointers = new Map<string, WritePointerTargets>()
    const remainingRead =  new Map<string, FoldReadTarget[]>() // name to id

    // TODO: this is probably wrong
    const nextGraph = children[0].graph.mergeWith(...children.slice(1).map(c => c.graph))

    for (const element of children) {
      const currentElement: FoldInfo = element

      // all inputs that have not been written until know, are read!
      for (const readId of [...currentElement.in, ...currentElement.activeNodes]) {
        const existingRef = dataflowIdMap.get(readId.id)
        const readName = existingRef?.lexeme
        guard (readName !== undefined, `Could not find name for read variable ${JSON.stringify(readId)}`)

        const probableTarget = writePointers.get(readName)
        if (probableTarget === undefined) {
          // keep it, for we have no target, as read-ids are unique within same fold, this should work for same links
          if(remainingRead.has(readName)) {
            remainingRead.get(readName)?.push(readId)
          } else {
            remainingRead.set(readName, [readId])
          }
        } else if (probableTarget.type === 'always') {
          nextGraph.addEdge(readId.id, probableTarget.id, 'read', readId.attribute)
        } else {
          for (const target of probableTarget.ids) {
            // we can stick with maybe even if readId.attribute is always
            nextGraph.addEdge(readId.id, target, 'read', 'maybe')
          }
        }
      }
      // add same variable reads for deferred if they are read previously but not dependent
      // TODO: deal with globals etc.
      for (const [, writeTargets] of currentElement.out) {
        for(const writeTarget of writeTargets) {
          const writeTargetIds = writeTarget.attribute === 'always' ? [writeTarget.id] : writeTarget.ids
          for (const writeId of writeTargetIds) {

            const existingRef = dataflowIdMap.get(writeId)
            const writeName = existingRef?.lexeme
            guard(writeName !== undefined, `Could not find name for write variable ${writeId}`)
            if (remainingRead.has(writeName)) {
              const readIds = remainingRead.get(writeName)
              guard(readIds !== undefined, `Could not find readId for write variable ${writeId}`)
              for (const readId of readIds) {
                // TODO: is this really correct with write and read roles inverted?
                nextGraph.addEdge(writeId, readId.id, 'defined-by', readId.attribute)
              }
            } else if (writePointers.has(writeName)) { // write-write
              const writePointer = writePointers.get(writeName)
              guard(writePointer !== undefined, `Could not find writePointer for write variable ${writeId}`)
              if (writePointer.type === 'always') {
                nextGraph.addEdge(writePointer.id, writeId, 'same-def-def', 'always')
              } else {
                for (const target of writePointer.ids) {
                  nextGraph.addEdge(target, writeId, 'same-def-def', 'always')
                }
              }
            }
          }
        }
      }

      // for each variable read add the closest write and if we have one, remove it from read
      updateAllWriteTargets(currentElement, dataflowIdMap, writePointers)
    }
    // now, we have to link same reads

    linkReadVariablesInSameScopeWithNames(nextGraph, new DefaultMap(() => [], remainingRead))

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

export function produceDataFlowGraph<OtherInfo>(ast: RNodeWithParent<OtherInfo>): DataflowInformation<OtherInfo> {
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
      foldAssignment:   processAssignment
    },
    unaryOp: {
      foldLogicalOp:    processUnaryOp,
      foldArithmeticOp: processUnaryOp
    },
    loop: {
      foldFor:    processForLoop,
      foldRepeat: processRepeatLoop,
      foldWhile:  processWhileLoop
    },
    other: {
      foldComment: processUninterestingLeaf,
    },
    foldIfThenElse:   processIfThenElse,
    foldExprList:     processExprList(dataflowIdMap),
    foldFunctionCall: processFunctionCall,
  })

  // TODO: process
  dataflowLogger.warn(`remaining actives: ${JSON.stringify(foldResult)}`)

  // TODO: implement
  return { dataflowIdMap, dataflowGraph: foldResult.graph }
}
