import { NormalizedAst, ParentInformation, RAssignmentOp, RBinaryOp, Type } from '../r-bridge'
import { DataflowInformation } from './internal/info'
import { DataflowProcessorInformation, DataflowProcessors, processDataflowFor } from './processor'
import { processUninterestingLeaf } from './internal/process/uninterestingLeaf'
import { processSymbol } from './internal/process/symbol'
import { processNonAssignmentBinaryOp } from './internal/process/operators/nonAssignmentBinaryOp'
import { processUnaryOp } from './internal/process/operators/unaryOp'
import { processExpressionList } from './internal/process/expressionList'
import { processRepeatLoop } from './internal/process/loops/repeatLoop'
import { processForLoop } from './internal/process/loops/forLoop'
import { processWhileLoop } from './internal/process/loops/whileLoop'
import { processIfThenElse } from './internal/process/ifThenElse'
import { processFunctionCall } from './internal/process/functions/functionCall'
import { processFunctionDefinition } from './internal/process/functions/functionDefinition'
import { processFunctionParameter } from './internal/process/functions/parameter'
import { DataflowScopeName, initializeCleanEnvironments } from './environments'
import { processFunctionArgument } from './internal/process/functions/argument'
import { processAssignment } from './internal/process/operators/assignment'
import { processAccess } from './internal/process/access'
import { processPipeOperation } from './internal/process/operators/pipe'
import { LocalScope } from './environments/scopes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- allows type adaption without re-creation
const processors: DataflowProcessors<any> = {
	[Type.Number]:             processUninterestingLeaf,
	[Type.String]:             processUninterestingLeaf,
	[Type.Logical]:            processUninterestingLeaf,
	[Type.Access]:             processAccess,
	[Type.Symbol]:             processSymbol,
	[Type.BinaryOp]:           processBinaryOp,
	[Type.Pipe]:               processPipeOperation,
	[Type.UnaryOp]:            processUnaryOp,
	[Type.ForLoop]:            processForLoop,
	[Type.WhileLoop]:          processWhileLoop,
	[Type.RepeatLoop]:         processRepeatLoop,
	[Type.IfThenElse]:         processIfThenElse,
	[Type.Break]:              processUninterestingLeaf,
	[Type.Next]:               processUninterestingLeaf,
	[Type.Comment]:            processUninterestingLeaf,
	[Type.LineDirective]:      processUninterestingLeaf,
	[Type.FunctionCall]:       processFunctionCall,
	[Type.FunctionDefinition]: processFunctionDefinition,
	[Type.Parameter]:          processFunctionParameter,
	[Type.Argument]:           processFunctionArgument,
	[Type.ExpressionList]:     processExpressionList,
}

export function produceDataFlowGraph<OtherInfo>(ast: NormalizedAst<OtherInfo & ParentInformation>, initialScope: DataflowScopeName = LocalScope): DataflowInformation {
	return processDataflowFor<OtherInfo>(ast.ast, { completeAst: ast, activeScope: initialScope, environments: initializeCleanEnvironments(), processors: processors as DataflowProcessors<OtherInfo & ParentInformation> })
}

export function processBinaryOp<OtherInfo>(node: RBinaryOp<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>) {
	if(node.flavor === 'assignment') {
		return processAssignment(node as RAssignmentOp<OtherInfo & ParentInformation>, data)
	} else {
		return processNonAssignmentBinaryOp(node, data)
	}
}
