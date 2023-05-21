import { DecoratedAst, ParentInformation } from '../r-bridge'
import { DataflowInformation } from './internal/info'
import { DataflowScopeName } from './graph'
import { dataflowFold, DataflowProcessorFolds } from './processor'
import { processUninterestingLeaf } from './internal/process/uninterestingLeaf'
import { processSymbol } from './internal/process/symbol'
import { processNonAssignmentBinaryOp } from './internal/process/nonAssignmentBinaryOp'
import { processAssignment } from './internal/process/assignment'
import { processUnaryOp } from './internal/process/unaryOp'
import { processExpressionList } from './internal/process/expressionList'
import { processRepeatLoop } from './internal/process/loops/repeatLoop'
import { processForLoop } from './internal/process/loops/forLoop'
import { processWhileLoop } from './internal/process/loops/whileLoop'
import { processIfThenElse } from './internal/process/ifThenElse'
import { processFunctionCall } from './internal/process/functions/functionCall'
import { processFunctionDefinition } from './internal/process/functions/functionDefinition'
import { processFunctionArgument } from './internal/process/functions/argument'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- allows type adaption without re-creation
const folds: DataflowProcessorFolds<any> = {
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
  foldIfThenElse: processIfThenElse,
  foldExprList:   processExpressionList,
  functions:      {
    foldFunctionDefinition: processFunctionDefinition,
    foldFunctionCall:       processFunctionCall,
    foldArgument:           processFunctionArgument
  }
}

export function produceDataFlowGraph<OtherInfo>(ast: DecoratedAst<OtherInfo & ParentInformation>, scope: DataflowScopeName): DataflowInformation<OtherInfo & ParentInformation> {
  return dataflowFold<OtherInfo>(ast.decoratedAst, { ast, scope }, folds as DataflowProcessorFolds<OtherInfo & ParentInformation>)
}

// TODO: automatically load namespace exported functions etc.

