import type { DataflowInformation } from './info'
import type { DataflowProcessorInformation, DataflowProcessors } from './processor'
import { processDataflowFor } from './processor'
import { processUninterestingLeaf } from './internal/process/process-uninteresting-leaf'
import { processSymbol } from './internal/process/process-symbol'
import { processFunctionCall } from './internal/process/functions/call/default-call-handling'
import { processFunctionParameter } from './internal/process/functions/process-parameter'
import { processFunctionArgument } from './internal/process/functions/process-argument'
import { processAsNamedCall } from './internal/process/process-named-call'
import { processValue } from './internal/process/process-value'
import { processNamedCall } from './internal/process/functions/call/named-call-handling'
import { wrapArgumentsUnnamed } from './internal/process/functions/call/argument/make-argument'
import { rangeFrom } from '../util/range'
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate'
import { RType } from '../r-bridge/lang-4.x/ast/model/type'
import type { RParseRequest, RParseRequests } from '../r-bridge/retriever'
import { isMultiFileRequest , requestFingerprint } from '../r-bridge/retriever'
import { initializeCleanEnvironments } from './environments/environment'
import { processFiles } from './internal/process/process-files'

export const processors: DataflowProcessors<ParentInformation> = {
	[RType.Number]:             processValue,
	[RType.String]:             processValue,
	[RType.Logical]:            processValue,
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
	[RType.ExpressionList]:     (n, d) => processNamedCall({
		type:      RType.Symbol,
		info:      n.info,
		content:   n.grouping?.[0].content ?? '{',
		lexeme:    n.grouping?.[0].lexeme ?? '{',
		location:  n.location ?? rangeFrom(-1, -1, -1, -1),
		namespace: n.grouping?.[0].content ? undefined : 'base'
	}, wrapArgumentsUnnamed(n.children, d.completeAst.idMap), n.info.id, d),
	[RType.Files]: processFiles
}

export function produceDataFlowGraph<OtherInfo>(
	request: RParseRequests,
	ast:     NormalizedAst<OtherInfo & ParentInformation>
): DataflowInformation {
	const multifile = isMultiFileRequest(request)
	let firstRequest: RParseRequest
	if(multifile) {
		firstRequest = request[0]
	} else {
		firstRequest = request
	}
	const dfData = {
		completeAst:         ast,
		environment:         initializeCleanEnvironments(),
		processors,
		currentRequest:      request,
		controlDependencies: undefined,
		referenceChain:      [requestFingerprint(firstRequest)] // TODO: is it okay to only use the first request here?
	} as DataflowProcessorInformation<OtherInfo & ParentInformation>
	return processDataflowFor<OtherInfo & ParentInformation>(ast.ast, dfData)
}
