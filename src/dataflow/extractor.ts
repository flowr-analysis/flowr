import { DecoratedAst, foldAst, FoldFunctions, IdType, ParentInformation } from '../r-bridge'
import { DataflowInfo, DataflowScopeName, initializeCleanInfo } from './info'

function produceFolds<OtherInfo>(): FoldFunctions<OtherInfo & ParentInformation, DataflowInfo<OtherInfo & ParentInformation>> {
  return null as any/* {
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
      foldWhile:  processWhileLoop,
      foldBreak:  processUninterestingLeaf,
      foldNext:   processUninterestingLeaf
    },
    other: {
      foldComment: processUninterestingLeaf,
    },
    foldIfThenElse:   processIfThenElse,
    foldExprList:     processExprList(dataflowIdMap),
    foldFunctionCall: processFunctionCall,
  } */
}

export function produceDataFlowGraph<OtherInfo>(ast: DecoratedAst<OtherInfo>, scope: DataflowScopeName): DataflowInfo<OtherInfo> {
  const info = initializeCleanInfo(ast, scope)

  return foldAst<OtherInfo & ParentInformation, DataflowInfo<OtherInfo & ParentInformation>>(ast.decoratedAst, produceFolds())

  return info
}

// TODO: automatically load namespace exported functions etc.

