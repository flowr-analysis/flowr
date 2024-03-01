import { RType } from '../../r-bridge'
import type { DataflowProcessors } from './internal/processor'
import { processUninterestingLeaf } from './internal/uninteresting-leaf'
import { processExpressionList } from '../v1/internal/process/expression-list'
import { processSymbol } from './internal/symbol'
import { processFunctionCall } from './internal/function-call'
import { processFunctionDefinition } from './internal/function-definition'
import { processFunctionParameter } from './internal/parameter'
import { processFunctionArgument } from './internal/argument'
import type { DataflowInformation } from '../common/info'

function error(): DataflowInformation {
	throw new Error('Not implemented')
}

/* for each node which is not intendet by normalize, we provide the v1 processor as fallback */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- allows type adaption without re-creation
export const processors: DataflowProcessors<any> = {
	[RType.Number]:             processUninterestingLeaf,
	[RType.String]:             processUninterestingLeaf,
	[RType.Logical]:            processUninterestingLeaf,
	[RType.Access]:             error,
	[RType.Symbol]:             processSymbol,
	[RType.BinaryOp]:           error,
	[RType.Pipe]:               error,
	[RType.UnaryOp]:            error,
	[RType.ForLoop]:            error,
	[RType.WhileLoop]:          error,
	[RType.RepeatLoop]:         error,
	[RType.IfThenElse]:         error,
	[RType.Break]:              error,
	[RType.Next]:               error,
	[RType.Comment]:            processUninterestingLeaf,
	[RType.LineDirective]:      processUninterestingLeaf,
	[RType.FunctionCall]:       processFunctionCall,
	[RType.FunctionDefinition]: processFunctionDefinition,
	[RType.Parameter]:          processFunctionParameter,
	[RType.Argument]:           processFunctionArgument,
	[RType.ExpressionList]:     processExpressionList,
}


