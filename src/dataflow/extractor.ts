import { NormalizedAst, ParentInformation, RAssignmentOp, RBinaryOp, RType } from '../r-bridge'
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
import { processFunctionCall } from './internal/process/functions/function-call'
import { processFunctionDefinition } from './internal/process/functions/function-definition'
import { processFunctionParameter } from './internal/process/functions/parameter'
import { DataflowScopeName, initializeCleanEnvironments } from './environments'
import { processFunctionArgument } from './internal/process/functions/argument'
import { processAssignment } from './internal/process/operators/assignment'
import { processAccess } from './internal/process/access'
import { processPipeOperation } from './internal/process/operators/pipe'
import { LocalScope } from './environments/scopes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- allows type adaption without re-creation
const processors: DataflowProcessors<any> = {
	[RType.Number]:             processUninterestingLeaf,
	[RType.String]:             processUninterestingLeaf,
	[RType.Logical]:            processUninterestingLeaf,
	[RType.Access]:             processAccess,
	[RType.Symbol]:             processSymbol,
	[RType.BinaryOp]:           processBinaryOp,
	[RType.Pipe]:               processPipeOperation,
	[RType.UnaryOp]:            processUnaryOp,
	[RType.ForLoop]:            processForLoop,
	[RType.WhileLoop]:          processWhileLoop,
	[RType.RepeatLoop]:         processRepeatLoop,
	[RType.IfThenElse]:         processIfThenElse,
	[RType.Break]:              processUninterestingLeaf,
	[RType.Next]:               processUninterestingLeaf,
	[RType.Comment]:            processUninterestingLeaf,
	[RType.LineDirective]:      processUninterestingLeaf,
	[RType.FunctionCall]:       processFunctionCall,
	[RType.FunctionDefinition]: processFunctionDefinition,
	[RType.Parameter]:          processFunctionParameter,
	[RType.Argument]:           processFunctionArgument,
	[RType.ExpressionList]:     processExpressionList,
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
