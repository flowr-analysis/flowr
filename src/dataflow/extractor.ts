import type { DataflowInformation } from './info';
import type { DataflowProcessorInformation, DataflowProcessors } from './processor';
import { processDataflowFor } from './processor';
import { processUninterestingLeaf } from './internal/process/process-uninteresting-leaf';
import { processSymbol } from './internal/process/process-symbol';
import { processFunctionCall } from './internal/process/functions/call/default-call-handling';
import { processFunctionParameter } from './internal/process/functions/process-parameter';
import { processFunctionArgument } from './internal/process/functions/process-argument';
import { processAsNamedCall } from './internal/process/process-named-call';
import { processValue } from './internal/process/process-value';
import { processNamedCall } from './internal/process/functions/call/named-call-handling';
import { wrapArgumentsUnnamed } from './internal/process/functions/call/argument/make-argument';
import { rangeFrom } from '../util/range';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import type { RParseRequest, RParseRequests } from '../r-bridge/retriever';
import { requestFingerprint } from '../r-bridge/retriever';
import { initializeCleanEnvironments } from './environments/environment';
import { standaloneSourceFile } from './internal/process/functions/call/built-in/built-in-source';
import type { DataflowGraph } from './graph/graph';
import type { ControlFlowGraph } from '../util/cfg/cfg';
import { extractCFG } from '../util/cfg/cfg';
import { EdgeType } from './graph/edge';
import {
	identifyLinkToLastCallRelation
} from '../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { KnownParserType, Parser } from '../r-bridge/parser';
import {
	updateNestedFunctionCalls
} from './internal/process/functions/call/built-in/built-in-function-definition';

/**
 * The best friend of {@link produceDataFlowGraph} and {@link processDataflowFor}.
 * Maps every {@link RType} in the normalized AST to a processor.
 */
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
	}, wrapArgumentsUnnamed(n.children, d.completeAst.idMap), n.info.id, d)
};


function resolveLinkToSideEffects(ast: NormalizedAst, graph: DataflowGraph) {
	let cfg: ControlFlowGraph | undefined = undefined;
	for(const s of graph.unknownSideEffects) {
		if(typeof s !== 'object') {
			continue;
		}
		cfg ??= extractCFG(ast, graph).graph;
		/* this has to change whenever we add a new link to relations because we currently offer no abstraction for the type */
		const potentials = identifyLinkToLastCallRelation(s.id, cfg, graph, s.linkTo);
		for(const pot of potentials) {
			graph.addEdge(s.id, pot, EdgeType.Reads);
		}
		if(potentials.length > 0) {
			graph.unknownSideEffects.delete(s);
		}
	}
}

/**
 * This is the main function to produce the dataflow graph from a given request and normalized AST.
 * Note, that this requires knowledge of the active parser in case the dataflow analysis uncovers other files that have to be parsed and integrated into the analysis
 * (e.g., in the event of a `source` call).
 * For the actual, canonical fold entry point, see {@link processDataflowFor}.
 */
export function produceDataFlowGraph<OtherInfo>(
	parser: Parser<KnownParserType>,
	request: RParseRequests,
	ast:     NormalizedAst<OtherInfo & ParentInformation>
): DataflowInformation {
	const multifile = Array.isArray(request);
	let firstRequest: RParseRequest;
	if(multifile) {
		firstRequest = request[0] as RParseRequest;
	} else {
		firstRequest = request as RParseRequest;
	}
	const dfData: DataflowProcessorInformation<OtherInfo & ParentInformation> = {
		parser:              parser,
		completeAst:         ast,
		environment:         initializeCleanEnvironments(),
		processors,
		currentRequest:      firstRequest,
		controlDependencies: undefined,
		referenceChain:      [requestFingerprint(firstRequest)]
	};
	let df = processDataflowFor<OtherInfo>(ast.ast, dfData);

	if(multifile) {
		for(let i = 1; i < request.length; i++) {
			df = standaloneSourceFile(request[i] as RParseRequest, dfData, `root-${i}`, df);
		}
	}

	// finally, resolve linkages
	updateNestedFunctionCalls(df.graph, df.environment);

	resolveLinkToSideEffects(ast, df.graph);
	return df;
}
