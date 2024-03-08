import type { NormalizedAst, ParentInformation, RParseRequest } from '../r-bridge'
import { RType, requestFingerprint } from '../r-bridge'
import type { DataflowInformation } from './info'
import type { DataflowProcessors } from './processor'
import { processDataflowFor } from './processor'
import { processUninterestingLeaf } from './internal/process/uninteresting-leaf'
import { processSymbol } from './internal/process/symbol'
import { processExpressionList } from './internal/process/expression-list'
import { processFunctionCall } from './internal/process/functions/call/default-call-handling'
import { processFunctionParameter } from './internal/process/functions/parameter'
import { initializeCleanEnvironments } from './environments'
import { processFunctionArgument } from './internal/process/functions/argument'
import { processAsNamedCall } from './internal/process/operators'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- allows type adaption without re-creation
export const processors: DataflowProcessors<ParentInformation> = {
	[RType.Number]:             processUninterestingLeaf,
	[RType.String]:             processUninterestingLeaf,
	[RType.Logical]:            processUninterestingLeaf,
	[RType.Comment]:            processUninterestingLeaf,
	[RType.LineDirective]:      processUninterestingLeaf,
	[RType.Symbol]:             processSymbol,
	[RType.Access]:             (n, d) => processAsNamedCall(n, d, n.operator, [n.accessed, ...n.access]),
	[RType.BinaryOp]:           (n, d) => processAsNamedCall(n, d, n.operator, [n.lhs, n.rhs]),
	[RType.Pipe]:               (n, d) => processAsNamedCall(n, d, n.lexeme, [n.lhs, n.rhs]),
	[RType.UnaryOp]:            (n, d) => processAsNamedCall(n, d, n.operator, [n.operand]),
	[RType.ForLoop]:            (n, d) => processAsNamedCall(n, d, n.lexeme, [n.variable, n.vector, n.body]),
	[RType.WhileLoop]:          (n, d) => processAsNamedCall(n, d, n.lexeme, [n.condition, n.body]),
	[RType.RepeatLoop]:         (n, d) => processAsNamedCall(n, d, n.lexeme, [n.body]),
	[RType.IfThenElse]:         (n, d) => processAsNamedCall(n, d, n.lexeme, [n.condition, n.then, n.otherwise]),
	[RType.Break]:              (n, d) => processAsNamedCall(n, d, n.lexeme, []),
	[RType.Next]:               (n, d) => processAsNamedCall(n, d, n.lexeme, []),
	[RType.FunctionCall]:       processFunctionCall,
	[RType.FunctionDefinition]: (n, d) => processAsNamedCall(n, d, n.lexeme, [...n.parameters, n.body]),
	[RType.Parameter]:          processFunctionParameter,
	[RType.Argument]:           processFunctionArgument,
	[RType.ExpressionList]:     processExpressionList /* TODO */
}

export function produceDataFlowGraph<OtherInfo>(request: RParseRequest, ast: NormalizedAst<OtherInfo & ParentInformation>): DataflowInformation {
	return processDataflowFor<OtherInfo>(ast.ast, {
		completeAst:    ast,
		environment:    initializeCleanEnvironments(),
		processors,
		currentRequest: request,
		referenceChain: [requestFingerprint(request)]
	})
}
