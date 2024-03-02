import type { NormalizedAst, ParentInformation, RBinaryOp, RParseRequest } from '../../r-bridge'
import { RType, requestFingerprint } from '../../r-bridge'
import type { DataflowInformation } from '../common/info'
import type { DataflowProcessorInformation, DataflowProcessors } from './processor'
import { processDataflowFor } from './processor'
import { processUninterestingLeaf } from './internal/process/uninteresting-leaf'
import { processSymbol } from './internal/process/symbol'
import { processNonAssignmentBinaryOp } from './internal/process/operators/non-assignment-binary-op'
import { processUnaryOp } from './internal/process/operators/unary-op'
import { processExpressionList } from './internal/process/expression-list'
import { processRepeatLoop } from './internal/process/loops/repeat-loop'
import { processForLoop } from './internal/process/loops/for-loop'
import { processWhileLoop } from './internal/process/loops/while-loop'
import { processIfThenElse } from './internal/process/if-then-else'
import { processFunctionCall } from './internal/process/functions/function-call'
import { processFunctionDefinition } from './internal/process/functions/function-definition'
import { processFunctionParameter } from './internal/process/functions/parameter'
import { initializeCleanEnvironments } from '../common/environments'
import { processFunctionArgument } from './internal/process/functions/argument'
import { processAssignment } from './internal/process/operators/assignment'
import { processAccess } from './internal/process/access'
import { processPipeOperation } from './internal/process/operators/pipe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- allows type adaption without re-creation
export const processors: DataflowProcessors<any> = {
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

export function produceDataFlowGraph<OtherInfo>(request: RParseRequest, ast: NormalizedAst<OtherInfo & ParentInformation>): DataflowInformation {
	return processDataflowFor<OtherInfo>(ast.ast, {
		completeAst:    ast,
		environments:   initializeCleanEnvironments(),
		processors:     processors as DataflowProcessors<OtherInfo & ParentInformation>,
		currentRequest: request,
		referenceChain: [requestFingerprint(request)]
	})
}

export function processBinaryOp<OtherInfo>(node: RBinaryOp<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>) {
	// TODO: move to env check
	if(node.operator === '<-' || node.operator === '<<-' || node.operator === '=' || node.operator === '->' || node.operator === '->>' || node.operator === ':=') {
		return processAssignment(node, data)
	} else {
		return processNonAssignmentBinaryOp(node, data)
	}
}
