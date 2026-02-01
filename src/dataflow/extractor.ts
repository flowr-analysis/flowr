import type { DataflowInformation } from './info';
import { type DataflowProcessorInformation, type DataflowProcessors, processDataflowFor } from './processor';
import { processUninterestingLeaf } from './internal/process/process-uninteresting-leaf';
import { processSymbol } from './internal/process/process-symbol';
import { processFunctionCall } from './internal/process/functions/call/default-call-handling';
import { processFunctionParameter } from './internal/process/functions/process-parameter';
import { processFunctionArgument } from './internal/process/functions/process-argument';
import { processAsNamedCall } from './internal/process/process-named-call';
import { processValue } from './internal/process/process-value';
import { processNamedCall } from './internal/process/functions/call/named-call-handling';
import { wrapArgumentsUnnamed } from './internal/process/functions/call/argument/make-argument';
import { invalidRange } from '../util/range';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { standaloneSourceFile } from './internal/process/functions/call/built-in/built-in-source';
import type { DataflowGraph } from './graph/graph';
import { extractCfgQuick, getCallsInCfg } from '../control-flow/extract-cfg';
import { EdgeType } from './graph/edge';
import { identifyLinkToLastCallRelationSync
} from '../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { KnownParserType, Parser } from '../r-bridge/parser';
import { updateNestedFunctionCalls } from './internal/process/functions/call/built-in/built-in-function-definition';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import type { FlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { FlowrFile } from '../project/context/flowr-file';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraphVertexFunctionCall } from './graph/vertex';
import type { LinkToLastCall } from '../queries/catalog/call-context-query/call-context-query-format';
import { Identifier } from './environments/identifier';

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
	[RType.ExpressionList]:     ({ grouping, info, children, location }, d) => {
		const groupStart = grouping?.[0];
		return processNamedCall({
			type:     RType.Symbol,
			info:     info,
			content:  groupStart?.content ?? '{',
			lexeme:   groupStart?.lexeme ?? '{',
			location: location ?? invalidRange(),
			ns:       groupStart?.content ? undefined : 'base'
		}, wrapArgumentsUnnamed(children, d.completeAst.idMap), info.id, d);
	}
};


function resolveLinkToSideEffects(ast: NormalizedAst, graph: DataflowGraph) {
	let cf: ControlFlowInformation | undefined = undefined;
	let knownCalls: Map<NodeId, Required<DataflowGraphVertexFunctionCall>> | undefined;
	let allCallNames: string[] = [];
	const killedRegexes = new Set<string>();
	const handled = new Set<NodeId>();
	for(const s of graph.unknownSideEffects) {
		if(typeof s !== 'object') {
			continue;
		}
		if(cf === undefined) {
			cf = extractCfgQuick(ast);
			if(graph.unknownSideEffects.size > 20) {
				knownCalls = getCallsInCfg(cf, graph);

				// TODO: maybe get name?
				allCallNames = Array.from(new Set(knownCalls.values().map(c => Identifier.toString(c.name))));
			}
		} else if(handled.has(s.id)) {
			continue;
		}
		handled.add(s.id);
		const regexKey = s.linkTo.callName.source + '//' + s.linkTo.callName.flags;
		if(killedRegexes.has(regexKey)) {
			// we already know we will not find it!
			continue;
		} else if(allCallNames.length > 0 && !allCallNames.some(name => s.linkTo.callName.test(name))) {
			// we know no call matches the regex
			killedRegexes.add(regexKey);
			continue;
		}
		/* this has to change whenever we add a new link to relations because we currently offer no abstraction for the type */
		const potentials = identifyLinkToLastCallRelationSync(s.id, cf.graph, graph, s.linkTo as LinkToLastCall<RegExp>, knownCalls);
		for(const pot of potentials) {
			graph.addEdge(s.id, pot, EdgeType.Reads);
		}
		if(potentials.length > 0) {
			graph.unknownSideEffects.delete(s);
		}
	}

	return cf;
}

/**
 * This is the main function to produce the dataflow graph from a given request and normalized AST.
 * Note, that this requires knowledge of the active parser in case the dataflow analysis uncovers other files that have to be parsed and integrated into the analysis
 * (e.g., in the event of a `source` call).
 * For the actual, canonical fold entry point, see {@link processDataflowFor}.
 */
export function produceDataFlowGraph<OtherInfo>(
	parser:      Parser<KnownParserType>,
	completeAst: NormalizedAst<OtherInfo & ParentInformation>,
	ctx:         FlowrAnalyzerContext
): DataflowInformation & { cfgQuick: ControlFlowInformation | undefined } {

	// we freeze the files here to avoid endless modifications during processing
	const files = completeAst.ast.files.slice();

	ctx.files.addConsideredFile(files[0].filePath ? files[0].filePath : FlowrFile.INLINE_PATH);

	const env = ctx.env.makeCleanEnv();
	env.current.n = ctx.meta.getNamespace();

	const dfData: DataflowProcessorInformation<OtherInfo & ParentInformation> = {
		parser,
		completeAst,
		environment:    env,
		processors:     ctx.config.solver.instrument.dataflowExtractors?.(processors, ctx) ?? processors,
		cds:            undefined,
		referenceChain: [files[0].filePath],
		ctx
	};
	let df = processDataflowFor<OtherInfo>(files[0].root, dfData);

	for(let i = 1; i < files.length; i++) {
		/* source requests register automatically */
		df = standaloneSourceFile(i, files[i], dfData, df);
	}

	// finally, resolve linkages
	updateNestedFunctionCalls(df.graph, df.environment);

	(df as { cfgQuick?: ControlFlowInformation }).cfgQuick = resolveLinkToSideEffects(completeAst, df.graph);
	// performance optimization: return cfgQuick as part of the result to avoid recomputation
	return df as DataflowInformation & { cfgQuick: ControlFlowInformation | undefined };
}
