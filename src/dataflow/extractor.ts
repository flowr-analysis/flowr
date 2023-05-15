import { DecoratedAst, ParentInformation } from '../r-bridge'
import { DataflowInfo, initializeCleanInfo } from './internal/info'
import { DataflowScopeName } from './graph'
import { dataflowFold, DataflowProcessorFolds } from './processor'
import { processUninterestingLeaf } from './internal/process/uninterestingLeaf'
import { processSymbol } from './internal/process/symbol'
import { processNonAssignmentBinaryOp } from './internal/process/nonAssignmentBinaryOp'
import { processAssignment } from './internal/process/assignment'
import { processUnaryOp } from './internal/process/unaryOp'
import { processExpressionList } from './internal/process/expressionList'
import { processRepeatLoop } from './internal/process/repeatLoop'
import { processForLoop } from './internal/process/forLoop'
import { processWhileLoop } from './internal/process/whileLoop'
import { processIfThenElse } from './internal/process/ifThenElse'
import { processFunctionCall } from './internal/process/functionCall'

function produceFolds<OtherInfo extends ParentInformation>(): DataflowProcessorFolds<OtherInfo> {
  return {
    foldNumber:  processUninterestingLeaf,
    foldString:  processUninterestingLeaf,
    foldLogical: processUninterestingLeaf,
    foldSymbol:  processSymbol,
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
    foldExprList:     processExpressionList,
    foldFunctionCall: processFunctionCall,
  }
}

export function produceDataFlowGraph<OtherInfo>(ast: DecoratedAst<OtherInfo & ParentInformation>, scope: DataflowScopeName): DataflowInfo<OtherInfo> {
  const info = initializeCleanInfo(ast, scope)

  return dataflowFold<OtherInfo>(ast.decoratedAst, { ast, scope }, produceFolds())

  return info
}

// TODO: automatically load namespace exported functions etc.

