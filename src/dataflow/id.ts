// assign each node with a unique id to simplify usage and further compares
import {
  foldAst,
  RExpressionList,
  RBinaryOp,
  RUnaryOp,
  RIfThenElse,
  RForLoop,
  RRepeatLoop,
  RWhileLoop,
  RFunctionCall,
  RNode,
  RSingleNode,
  Type
} from '../r-bridge'
import { BiMap } from "../util/bimap"
import { guard } from '../util/assert'

export type IdType = string;

export interface Id {
  id: IdType
}

/** uniquely identifies AST-Nodes now we have an information! */
export type IdRNode<OtherInfo> = RNode<OtherInfo & Id> & { info: OtherInfo & Id }

export type IdGenerator<OtherInfo> = (data: RNode<OtherInfo>) => IdType

// TODO: other generators? => like one that uses the location
/**
 * The simplest id generator which just increments a number on each call
 */
export function deterministicCountingIdGenerator<OtherInfo>(start = 0): IdGenerator<OtherInfo> {
  let id = start
  return () => `${id++}`
}

export interface AstWithIdInformation<OtherInfo> {
  idMap:        BiMap<IdType, IdRNode<OtherInfo>>
  decoratedAst: IdRNode<OtherInfo>
}

/**
 * Decorate the given AST by assigning an unique ID to each node
 *
 * @param ast    - the ast to decorate, must not already have an id field! (TODO: check guard)
 * @param getId  - the id generator: must generate a unique id für each passed node
 *
 * @typeParam OtherInfo - the original decoration of the ast nodes (probably is nothing as the id decoration is most likely the first step to be performed after extraction)
 *
 * TODO: add id map to more quickly access these ids in the future =\> make it usable for we create new nodes with parents =\> move to parents?
 */
export function decorateWithIds<OtherInfo>(ast: RNode<Exclude<OtherInfo, Id>>, getId: IdGenerator<OtherInfo> = deterministicCountingIdGenerator<OtherInfo>()): AstWithIdInformation<OtherInfo> {
  const idMap = new BiMap<IdType, IdRNode<OtherInfo>>()
  // TODO: -> add map

  const foldLeaf = (leaf: RSingleNode<OtherInfo>): IdRNode<OtherInfo> => {
    const newLeaf: IdRNode<OtherInfo> = {
      ...leaf,
      info: {
        ...(leaf.info as OtherInfo),
        id: getId(leaf)
      }
    }
    idMap.set(newLeaf.info.id, newLeaf)
    return newLeaf
  }
  const binaryOp = (op: RBinaryOp<OtherInfo>, lhs: IdRNode<OtherInfo>, rhs: IdRNode<OtherInfo>): IdRNode<OtherInfo> => {
    const newOp: IdRNode<OtherInfo> = {
      ...op,
      lhs,
      rhs,
      info: {
        ...(op.info as OtherInfo),
        id: getId(op)
      }
    }
    idMap.set(newOp.info.id, newOp)
    return newOp
  }
  const unaryOp = (op: RUnaryOp<OtherInfo>, operand: IdRNode<OtherInfo>): IdRNode<OtherInfo> => {
    const newOp: IdRNode<OtherInfo> = {
      ...op,
      operand,
      info: {
        ...(op.info as OtherInfo),
        id: getId(op)
      }
    }
    idMap.set(newOp.info.id, newOp)
    return newOp
  }
  const foldIfThenElse = (ifThen: RIfThenElse<OtherInfo>, condition: IdRNode<OtherInfo>, then: IdRNode<OtherInfo>, otherwise?: IdRNode<OtherInfo>): IdRNode<OtherInfo> => {
    const newIfThen: IdRNode<OtherInfo> = {
      ...ifThen,
      condition,
      then,
      otherwise,
      info: {
        ...(ifThen.info as OtherInfo),
        id: getId(ifThen)
      }
    }
    idMap.set(newIfThen.info.id, newIfThen)
    return newIfThen
  }
  const foldExprList = (exprList: RExpressionList<OtherInfo>, children: IdRNode<OtherInfo>[]): IdRNode<OtherInfo> => {
    const newExprList: IdRNode<OtherInfo> = {
      ...exprList,
      children,
      info: {
        ...(exprList.info as OtherInfo),
        id: getId(exprList)
      }
    }
    idMap.set(newExprList.info.id, newExprList)
    return newExprList
  }

  const foldFunctionCall = (functionCall: RFunctionCall<OtherInfo>, functionName: IdRNode<OtherInfo>, parameters: IdRNode<OtherInfo>[]): IdRNode<OtherInfo> => {
    guard(functionName.type === Type.Symbol, 'functionName must be a symbol')
    const newFunctionCall: IdRNode<OtherInfo> = {
      ...functionCall,
      functionName,
      parameters,
      info: {
        ...(functionCall.info as OtherInfo),
        id: getId(functionCall)
      }
    }
    idMap.set(newFunctionCall.info.id, newFunctionCall)
    return newFunctionCall
  }

  const foldFor = (forLoop: RForLoop<OtherInfo>, variable: IdRNode<OtherInfo>, vector: IdRNode<OtherInfo>, body: IdRNode<OtherInfo>): IdRNode<OtherInfo> => {
    guard(variable.type === Type.Symbol, 'variable must be a symbol')
    const newForLoop: IdRNode<OtherInfo> = {
      ...forLoop,
      variable,
      vector,
      body,
      info: {
        ...(forLoop.info as OtherInfo),
        id: getId(forLoop)
      }
    }
    idMap.set(newForLoop.info.id, newForLoop)
    return newForLoop
  }

  const foldRepeat = (repeatLoop: RRepeatLoop<OtherInfo>, body: IdRNode<OtherInfo>): IdRNode<OtherInfo> => {
    const newRepeatLoop: IdRNode<OtherInfo> = {
      ...repeatLoop,
      body,
      info: {
        ...(repeatLoop.info as OtherInfo),
        id: getId(repeatLoop)
      }
    }
    idMap.set(newRepeatLoop.info.id, newRepeatLoop)
    return newRepeatLoop
  }


  const foldWhile = (whileLoop: RWhileLoop<OtherInfo>, condition: IdRNode<OtherInfo>, body: IdRNode<OtherInfo>): IdRNode<OtherInfo> => {
    const newRepeatLoop: IdRNode<OtherInfo> = {
      ...whileLoop,
      body,
      condition,
      info: {
        ...(whileLoop.info as OtherInfo),
        id: getId(whileLoop)
      }
    }
    idMap.set(newRepeatLoop.info.id, newRepeatLoop)
    return newRepeatLoop
  }

  const decoratedAst = foldAst(ast, {
    foldNumber:  foldLeaf,
    foldString:  foldLeaf,
    foldLogical: foldLeaf,
    foldSymbol:  foldLeaf,
    binaryOp:    {
      foldLogicalOp:    binaryOp,
      foldArithmeticOp: binaryOp,
      foldComparisonOp: binaryOp,
      foldAssignment:   binaryOp
    },
    unaryOp: {
      foldArithmeticOp: unaryOp,
      foldLogicalOp:    unaryOp,
    },
    other: {
      foldComment: foldLeaf
    },
    loop: {
      foldFor,
      foldRepeat,
      foldWhile
    },
    foldIfThenElse,
    foldExprList,
    foldFunctionCall
  })

  return {
    decoratedAst,
    idMap
  }
}
