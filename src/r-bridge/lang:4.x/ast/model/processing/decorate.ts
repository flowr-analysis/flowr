/**
 * The decoration module is tasked with taking an R-ast given by a {@link RNode} and
 *
 * 1. assigning a unique id to each node (see {@link RNodeWithId})
 * 2. transforming the AST into a doubly linked tree using the ids (so it stays serializable)
 *
 * @module
 */

import { NoInfo, RNode } from '../model'
import { guard } from '../../../../../util/assert'
import { SourceRange } from '../../../../../util/range'
import { BiMap } from '../../../../../util/bimap'
import { foldAst } from './fold'

/** The type of the id assigned to each node */
export type IdType = string;

/**
 * A function that given an RNode returns a (guaranteed) unique id for it
 * @param data - the node to generate an id for
 *
 * @returns a unique id for the given node
 */
export type IdGenerator<OtherInfo> = (data: RNode<OtherInfo>) => IdType

/**
 * The simplest id generator which just increments a number on each call.
 */
export function deterministicCountingIdGenerator<OtherInfo>(start = 0): IdGenerator<OtherInfo> {
  let id = start
  return () => `${id++}`
}

function loc2Id(loc: SourceRange) {
  return `${loc.start.line}:${loc.start.column}-${loc.end.line}:${loc.end.column}`
}

/**
 * Generates the location id, used by {@link deterministicLocationIdGenerator}.
 *
 * @param data - the node to generate an id for, must have location information
 */
export function nodeToLocationId<OtherInfo>(data: RNode<OtherInfo>): IdType {
  const loc = data.location
  guard(loc !== undefined, 'location must be defined to generate a location id')
  return loc2Id(loc)
}

/**
 * Generates unique ids based on the locations of the node (see {@link nodeToLocationId}).
 * If a node has no location information, it will be assigned a unique counter value.
 *
 * @param start - the start value for the counter in case nodes do not have a location information
 */
export function deterministicLocationIdGenerator<OtherInfo>(start = 0): IdGenerator<OtherInfo> {
  let id = start
  return (data: RNode<OtherInfo>) => data.location !== undefined ? nodeToLocationId(data) : `${id++}`
}

export type RNodeWithParent<OtherInfo = NoInfo> = RNode<OtherInfo & {
  /** uniquely identifies an AST-Node */
  id:     IdType
  /** Links to the parent node, using an id so that the AST stays serializable */
  parent: IdType | undefined
}>


type DecoratedAstMap<OtherInfo> = BiMap<IdType, RNodeWithParent<OtherInfo>>
interface FoldInfo<OtherInfo> { idMap: DecoratedAstMap<OtherInfo>, getId: IdGenerator<OtherInfo> }

/**
 * Contains the AST as a doubly linked tree and a map from ids to nodes so that parent links can be chased easily.
 */
export interface DecoratedAst<OtherInfo> {
  /** Bidirectional mapping of ids to the corresponding nodes and the other way */
  idMap:        DecoratedAstMap<OtherInfo>
  /** The root of the AST with parent information */
  decoratedAst: RNodeWithParent<OtherInfo>
}


/**
 * Covert the given AST into a doubly linked tree while assigning ids (so it stays serializable).
 *
 * @param ast   - the root of the AST to convert
 * @param getId - the id generator: must generate a unique id für each passed node
 *
 * @typeParam OtherInfo - the original decoration of the ast nodes (probably is nothing as the id decoration is most likely the first step to be performed after extraction)
 *
 * @returns a {@link DecoratedAst | decorated AST} based on the input and the id provider.
 */
export function decorateAst<OtherInfo = NoInfo>(ast: RNode<OtherInfo>, getId: IdGenerator<OtherInfo> = deterministicCountingIdGenerator(0)): DecoratedAst<OtherInfo> {
  const idMap: DecoratedAstMap<OtherInfo> = new BiMap<IdType, RNodeWithParent<OtherInfo>>()
  const info: FoldInfo<OtherInfo> = { idMap, getId }

  /* Please note, that all fold processors do not re-create copies in higher folding steps so that the idMap stays intact. */
  const foldLeaf = createFoldForLeaf(info)
  const foldBinaryOp = createFoldForBinaryOp(info)
  const unaryOp = createFoldForUnaryOp(info)

  const decoratedAst: RNodeWithParent<OtherInfo> = foldAst(ast, {
    foldNumber:  foldLeaf,
    foldString:  foldLeaf,
    foldLogical: foldLeaf,
    foldSymbol:  foldLeaf,
    binaryOp:    {
      foldLogicalOp:    foldBinaryOp,
      foldArithmeticOp: foldBinaryOp,
      foldComparisonOp: foldBinaryOp,
      foldAssignment:   foldBinaryOp
    },
    unaryOp: {
      foldArithmeticOp: unaryOp,
      foldLogicalOp:    unaryOp,
    },
    other: {
      foldComment: foldLeaf
    },
    loop: {
      foldFor:    createFoldForForLoop(info),
      foldRepeat: createFoldForRepeatLoop(info),
      foldWhile:  createFoldForWhileLoop(info),
    },
    foldIfThenElse:   createFoldForIfThenElse(info),
    foldExprList:     createFoldForExprList(info),
    foldFunctionCall: createFoldForFunctionCall(info),
  })

  return {
    decoratedAst,
    idMap
  }
}

function createFoldForLeaf<OtherInfo>(info: FoldInfo<OtherInfo>) {
  return (data: RNode<OtherInfo>): RNodeWithParent<OtherInfo> => {
    const id = info.getId(data)
    const decorated = { ...data, info: { ...(data.info ), id, parent: undefined } } as RNodeWithParent<OtherInfo>
    info.idMap.set(id, decorated)
    return decorated
  }
}

function createFoldForBinaryOp<OtherInfo>(info: FoldInfo<OtherInfo>) {
  return (data: RNode<OtherInfo>, lhs: RNodeWithParent<OtherInfo>, rhs: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    const id = info.getId(data)
    const decorated = { ...data, info: { ...(data.info ), id, parent: undefined }, lhs, rhs } as RNodeWithParent<OtherInfo>
    info.idMap.set(id, decorated)
    lhs.info.parent = id
    rhs.info.parent = id
    return decorated
  }
}

function createFoldForUnaryOp<OtherInfo>(info: FoldInfo<OtherInfo>) {
  return (data: RNode<OtherInfo>, operand: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    const id = info.getId(data)
    const decorated = { ...data, info: { ...(data.info ), id, parent: undefined }, operand } as RNodeWithParent<OtherInfo>
    info.idMap.set(id, decorated)
    operand.info.parent = id
    return decorated
  }
}

function createFoldForForLoop<OtherInfo>(info: FoldInfo<OtherInfo>) {
  return (data: RNode<OtherInfo>, variable: RNodeWithParent<OtherInfo>, vector: RNodeWithParent<OtherInfo>, body: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    const id = info.getId(data)
    const decorated = { ...data, info: { ...(data.info ), id, parent: undefined }, variable, vector, body } as RNodeWithParent<OtherInfo>
    info.idMap.set(id, decorated)
    variable.info.parent = id
    vector.info.parent = id
    body.info.parent = id
    return decorated
  }
}

function createFoldForRepeatLoop<OtherInfo>(info: FoldInfo<OtherInfo>) {
  return (data: RNode<OtherInfo>, body: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    const id = info.getId(data)
    const decorated = { ...data, info: { ...(data.info ), id, parent: undefined },  body } as RNodeWithParent<OtherInfo>
    info.idMap.set(id, decorated)
    body.info.parent = id
    return decorated
  }
}

function createFoldForWhileLoop<OtherInfo>(info: FoldInfo<OtherInfo>) {
  return (data: RNode<OtherInfo>, condition: RNodeWithParent<OtherInfo>, body: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    const id = info.getId(data)
    const decorated = { ...data, info: { ...(data.info ), id, parent: undefined },  condition, body } as RNodeWithParent<OtherInfo>
    info.idMap.set(id, decorated)
    condition.info.parent = id
    body.info.parent = id
    return decorated
  }
}

function createFoldForIfThenElse<OtherInfo>(info: FoldInfo<OtherInfo>) {
  return (data: RNode<OtherInfo>, condition: RNodeWithParent<OtherInfo>, then: RNodeWithParent<OtherInfo>, otherwise?: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    const id = info.getId(data)
    const decorated = { ...data, info: { ...(data.info ), id, parent: undefined },  condition, then, otherwise } as RNodeWithParent<OtherInfo>
    info.idMap.set(id, decorated)
    condition.info.parent = id
    then.info.parent = id
    if(otherwise) {
      otherwise.info.parent = id
    }
    return decorated
  }
}

function createFoldForExprList<OtherInfo>(info: FoldInfo<OtherInfo>) {
  return (data: RNode<OtherInfo>, children: RNodeWithParent<OtherInfo>[]): RNodeWithParent<OtherInfo> => {
    const id = info.getId(data)
    const decorated = { ...data, info: { ...(data.info ), id, parent: undefined }, children } as RNodeWithParent<OtherInfo>
    info.idMap.set(id, decorated)
    children.forEach(expr => expr.info.parent = id)
    return decorated
  }
}

function createFoldForFunctionCall<OtherInfo>(info: FoldInfo<OtherInfo>) {
  return (data: RNode<OtherInfo>, functionName: RNodeWithParent<OtherInfo>, parameters: RNodeWithParent<OtherInfo>[]): RNodeWithParent<OtherInfo> => {
    const id = info.getId(data)
    const decorated = { ...data, info: { ...(data.info ), id, parent: undefined },  functionName, parameters } as RNodeWithParent<OtherInfo>
    info.idMap.set(id, decorated)
    functionName.info.parent = id
    parameters.forEach(arg => arg.info.parent = id)
    return decorated
  }
}
