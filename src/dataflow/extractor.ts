import { DeserializeDataflowInformation, type DataflowInformation } from './info';
import { type DataflowProcessorInformation, type DataflowProcessors, DeserializeDataflowProcessorInformation, processDataflowFor, SerializeDataflowProcessorInformation } from './processor';
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
import { mergeDataflowInformation, standaloneSourceFile } from './internal/process/functions/call/built-in/built-in-source';
import type { DataflowGraph } from './graph/graph';
import { extractCfgQuick, getCallsInCfg } from '../control-flow/extract-cfg';
import { edgeIncludesType, EdgeType } from './graph/edge';
import {
	identifyLinkToLastCallRelation
} from '../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { KnownParserType, Parser } from '../r-bridge/parser';
import { updateNestedFunctionCalls } from './internal/process/functions/call/built-in/built-in-function-definition';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import type { FlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { FlowrFile } from '../project/context/flowr-file';
import { recoverName, type NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType, type DataflowGraphVertexFunctionCall } from './graph/vertex';
import { dataflowLogger } from './logger';
import type { DataflowPayload, DataflowReturnPayload } from './parallel/task-registry';
import type { REnvironmentInformation } from './environments/environment';
import { linkInputs } from './internal/linker';
import type { IdentifierReference } from './environments/identifier';
import { isReferenceType, ReferenceType } from './environments/identifier';
import { resolveByName } from './environments/resolve-by-name';

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
			type:      RType.Symbol,
			info:      info,
			content:   groupStart?.content ?? '{',
			lexeme:    groupStart?.lexeme ?? '{',
			location:  location ?? rangeFrom(-1, -1, -1, -1),
			namespace: groupStart?.content ? undefined : 'base'
		}, wrapArgumentsUnnamed(children, d.completeAst.idMap), info.id, d);
	}
};


function resolveLinkToSideEffects(ast: NormalizedAst, graph: DataflowGraph) {
	let cf: ControlFlowInformation | undefined = undefined;
	let knownCalls: Map<NodeId, Required<DataflowGraphVertexFunctionCall>> | undefined;
	const handled = new Set<NodeId>();
	for(const s of graph.unknownSideEffects) {
		if(typeof s !== 'object') {
			continue;
		}
		if(cf === undefined) {
			cf = extractCfgQuick(ast);
			if(graph.unknownSideEffects.size > 20) {
				knownCalls = getCallsInCfg(cf, graph);
			}
		} else if(handled.has(s.id)) {
			continue;
		}
		handled.add(s.id);
		/* this has to change whenever we add a new link to relations because we currently offer no abstraction for the type */
		const potentials = identifyLinkToLastCallRelation(s.id, cf.graph, graph, s.linkTo, knownCalls);
		for(const pot of potentials) {
			graph.addEdge(s.id, pot, EdgeType.Reads);
		}
		if(potentials.length > 0) {
			graph.unknownSideEffects.delete(s);
		}
	}

	return cf;
}

function resolveCrossFileReferences(
	graph: DataflowGraph,
	environment: REnvironmentInformation,
): void {
	/** get all unresolved reads in the dataflow graph, ignore nothing */
	const unresolved: IdentifierReference[] = [];

	for(const [nodeId, vertex] of graph.verticesOfType(VertexType.Use)){
		const outgoing = graph.outgoingEdges(nodeId);

		const hasReads = (outgoing !== undefined) && [...outgoing.entries()].some(
			([,edge]) => edgeIncludesType(edge.types, EdgeType.Reads)
		);

		if(!hasReads) {
			unresolved.push({
				nodeId,
				name:                recoverName(nodeId, graph.idMap),
				controlDependencies: vertex.cds,
				type:                ReferenceType.Variable
			});
		}
	}

	for(const [nodeId, vertex] of graph.verticesOfType(VertexType.FunctionCall)){
		const outgoing = graph.outgoingEdges(nodeId);

		const hasReads = (outgoing !== undefined) && [...outgoing.entries()].some(
			([,edge]) => edgeIncludesType(edge.types, EdgeType.Reads)
		);

		if(!hasReads) {
			unresolved.push({
				nodeId,
				name:                recoverName(nodeId, graph.idMap) ?? vertex.name,
				controlDependencies: vertex.cds,
				type:                ReferenceType.Function
			});
		}
	}

	console.log('Found following unresolved references: ', unresolved);

	linkInputs(unresolved, environment, [], graph, false);

	/** resolve vertices with only builtins again and update if placeholder */
    /** why do i need to do this? */
	for(const [nodeId,] of graph.verticesOfType(VertexType.Use)) {
		const name = recoverName(nodeId, graph.idMap);
		if(!name) continue;
		
		const type = ReferenceType.Variable;
		const outgoing = graph.outgoingEdges(nodeId);
		
		/* Check if this node currently only has built-in edges */
		const allEdgesAreBuiltIns = outgoing !== undefined && [...outgoing.entries()].every(([target]) =>
			typeof target === 'string' && target.includes('built-in')
		);
		
		if(allEdgesAreBuiltIns) {
			/* Try to resolve in the merged environment */
			const targets = resolveByName(name, environment, type);
			if(targets && targets.length > 0) {
				// Get user-defined targets only
				const userDefinedTargets = targets.filter(t =>
					!isReferenceType(t.type, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction)
				);
				
				if(userDefinedTargets.length > 0) {
					/* Check if targets only includes user-defined (no built-in fallbacks) */
					const onlyUserDefined = userDefinedTargets.length === targets.length;
					
					if(onlyUserDefined) {
						/* Remove placeholder built-in edges since we have pure user-defined targets */
						if(outgoing) {
							for(const [target] of outgoing) {
								if(typeof target === 'string' && target.includes('built-in')) {
									graph.removeEdge(nodeId, target);
								}
							}
						}
					}
					
					/* Add edges to user-defined targets (whether or not we removed built-ins) */
					for(const target of userDefinedTargets) {
						const outgoing = graph.outgoingEdges(nodeId);
						const alreadyLinked = outgoing?.has(target.nodeId);
						if(!alreadyLinked) {
							graph.addEdge(nodeId, target.nodeId, EdgeType.Reads);
						}
					}
				}
			}
		}
	}

	if(unresolved.length > 0){
		console.warn(`Cross File Resolution: ${unresolved.length} reference(s) remain unresolved across all files for the dataflow graph: ` +
            unresolved.map(reference => reference.name ?? '<unnamed>').join(',')
		);
	}
}

/**
 * This is the main function to produce the dataflow graph from a given request and normalized AST.
 * Note, that this requires knowledge of the active parser in case the dataflow analysis uncovers other files that have to be parsed and integrated into the analysis
 * (e.g., in the event of a `source` call).
 * For the actual, canonical fold entry point, see {@link processDataflowFor}.
 */
export async function produceDataFlowGraph<OtherInfo>(
	parser:      Parser<KnownParserType>,
	completeAst: NormalizedAst<OtherInfo & ParentInformation>,
	ctx:         FlowrAnalyzerContext,
): Promise<DataflowInformation & { cfgQuick: ControlFlowInformation | undefined }> {

	// we freeze the files here to avoid endless modifications during processing
	const files = completeAst.ast.files.slice();

	ctx.files.addConsideredFile(files[0].filePath ? files[0].filePath : FlowrFile.INLINE_PATH);

	const fileParallelization = ctx.config.optimizations.fileParallelization;
	const workerPool = fileParallelization ? ctx.workerPool : undefined;

	const dfData: DataflowProcessorInformation<OtherInfo & ParentInformation> = {
		parser,
		completeAst,
		environment:         ctx.env.makeCleanEnv(),
		processors,
		controlDependencies: undefined,
		referenceChain:      [files[0].filePath],
		ctx
	};

	if(fileParallelization && workerPool){
		// parse data
		const parsed = SerializeDataflowProcessorInformation(dfData);
		const result = await workerPool.submitTasks<DataflowPayload<OtherInfo>, DataflowReturnPayload<OtherInfo>>(
			'parallelFiles',
			files.map((file, i) => ({
				index: i,
				file,
				data:  parsed,
			}))
		);

		const parsedResult = result.map(data => {
			const dfInfo = DeserializeDataflowProcessorInformation(data.processorInfo, dfData.processors, dfData.parser);
			const dataflow = DeserializeDataflowInformation(data.dataflowData, dfInfo.ctx);
			return {
				processorInfo: dfInfo,
				dataflow:      dataflow,
			};
		});

		let df = parsedResult[0].dataflow;
		console.log('result length: ', parsedResult.length);

		// merge dataflowinformation via folding
		for(let i = 1; i < result.length; i++){
			console.log('merging dataflow for file-', i);
			df = mergeDataflowInformation('file-'+i, parsedResult[i].processorInfo, files[i].filePath, df, parsedResult[i].dataflow);
			resolveCrossFileReferences(df.graph, df.environment);
		}


		// finally, resolve linkages
		updateNestedFunctionCalls(df.graph, df.environment);

		const cfgQuick = resolveLinkToSideEffects(completeAst, df.graph);

		// performance optimization: return cfgQuick as part of the result to avoid recomputation
		return { ...df, cfgQuick };

	}

	if(!workerPool && fileParallelization){
		dataflowLogger.error('Dataflow:: Parallelization is enabled, but no Threadpool is provided. Falling back to sequential computation.');
	}
	// use the sequential analysis
	let df = processDataflowFor<OtherInfo>(files[0].root, dfData);

	for(let i = 1; i < files.length; i++) {
		/* source requests register automatically */
		df = standaloneSourceFile(i, files[i], dfData, df);
	}

	// finally, resolve linkages
	updateNestedFunctionCalls(df.graph, df.environment);

	const cfgQuick = resolveLinkToSideEffects(completeAst, df.graph);

	// performance optimization: return cfgQuick as part of the result to avoid recomputation
	return { ...df, cfgQuick };

}
