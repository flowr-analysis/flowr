import fs from 'node:fs';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import { fileProtocol } from '../r-bridge/retriever';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import { VertexType } from '../dataflow/graph/vertex';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { IntervalExpressionSemanticsMapper } from './interval/expression-semantics';
import { Identifier } from '../dataflow/environments/identifier';
import { PentagonExpressionSemanticsMapper } from './pentagon/expression-semantics';
import { IntervalSemanticsMaper } from './interval/condition-semantics';
import { UpperBoundsSemanticsMapper } from './pentagon/upper-bounds/upper-bounds-condition-semantics';
import { NumericIntervalInferenceVisitor } from './interval/numeric-interval-inference';
import { SourceRange } from '../util/range';
import { NumericPentagonInferenceVisitor } from './pentagon/numeric-pentagon-inference';
import path from 'path';
import type { AbsintVisitorConfiguration } from './absint-visitor';
import { superBigJsonStringify } from '../util/json';
import { UnsupportedFunctions } from './unsupported-functions';
import type { LintingResultsSuccess } from '../linter/linter-format';

if(process.argv.length < 4) {
	console.error('Usage: ts-node src/abstract-interpretation/benchmarking.ts <file-to-analyze> <output-folder>');
	process.exit(1);
}

const [_, __, filePath, outputDirectory] = process.argv;

interface FileMetadata {
	fileName:                               string;
	intervalResultFileName:                 string;
	pentagonResultFileName:                 string;
	loc:                                    number;
	cloc:                                   number;
	numOfDfgNodes:                          number;
	numOfCfgNodes:                          number;
	numOfConstants:                         number;
	numOfRNumberConstants:                  number;
	RNumberConstantNodeIds:                 NodeId[];
	numOfFunctionDefinitions:               number;
	numOfFunctionCalls:                     number;
	numOfSupportedExpressionFunctionCalls:  number;
	SupportedExpressionFunctionCallNodeIds: NodeId[];
	numOfSupportedConditionFunctionCalls:   number;
	SupportedConditionFunctionCalls:        NodeId[];
	numOfConditions:                        number;
	numOfIfThenElse:                        number;
	numOfWhile:                             number;
	numOfStopIfNot:                         number;
	numOfFnWithUnknownSideEffect:           number;
	linterDeadCodeIds:                      NodeId[];
	metadataGatheringInMs:                  number;
	baselineInMs:                           number;
	astInMs:                                number;
	dfgInMs:                                number;
	cfgInMs:                                number;
	intervalAnalysisInMs:                   number;
	intervalResultGatheringInMs:            number;
	pentagonAnalysisInMs:                   number;
	pentagonResultGatheringInMs:            number;
}

interface InferredValue {
	nodeId:             NodeId;
	inferredValue:      string;
	significantFigures: string;
	sourceLocation:     string;
	lexeme:             string;
	dfgTag:             VertexType | 'unknown';
}

void async function() {
	fs.mkdirSync(outputDirectory, { recursive: true });
	const fileName = path.basename(filePath);
	const fileNameWithoutEnding = path.parse(fileName).name;
	const metadataOutputFile = fileNameWithoutEnding + '.json';
	const intervalResultFile = fileNameWithoutEnding + '-interval.json';
	const pentagonResultFile = fileNameWithoutEnding + '-pentagon.json';

	const baselineStart = performance.now();
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();
	analyzer.addRequest(fileProtocol + filePath);
	const astStart = performance.now();
	const ast = await analyzer.normalize();
	const dfgStart = performance.now();
	const dfg = (await analyzer.dataflow()).graph;
	const cfgStart = performance.now();
	const cfg = await analyzer.controlflow();
	const cfgEnd = performance.now();
	const ctx = analyzer.context();
	const baselineEnd = performance.now();

	const visitorContext: AbsintVisitorConfiguration = { normalizedAst: ast, dfg, controlFlow: cfg, ctx };

	// Run Interval Analysis
	const intervalVisitor = new NumericIntervalInferenceVisitor(visitorContext);

	const intervalStart = performance.now();
	intervalVisitor.start();
	const intervalEnd = performance.now();

	const intervalResultStart = performance.now();
	const intervalResults: InferredValue[] = [];
	for(const nodeId of intervalVisitor.getAbstractTrace().keys()) {
		const value = intervalVisitor.getAbstractValue(nodeId);
		if(value !== undefined) {
			const node = ast.idMap.get(nodeId);

			intervalResults.push({
				nodeId:             nodeId,
				inferredValue:      value.toString() ?? 'undefined',
				significantFigures: value.significantFigures?.toString() ?? 'unknown',
				sourceLocation:     SourceRange.fromNode(node)?.toString() ?? 'unknown',
				lexeme:             node?.lexeme ?? 'unknown',
				dfgTag:             dfg.getVertex(nodeId)?.tag ?? 'unknown',
			});
		}
	}
	const intervalResultEnd = performance.now();

	// Dump Interval Results
	const intervalPath = path.join(outputDirectory, intervalResultFile);
	fs.rmSync(intervalPath, { recursive: true, force: true });
	superBigJsonStringify(intervalResults, '\n', (msg) => fs.appendFileSync(intervalPath, msg));

	// Run Pentagon Analysis
	const pentagonVisitor = new NumericPentagonInferenceVisitor(visitorContext);

	const pentagonStart = performance.now();
	pentagonVisitor.start();
	const pentagonEnd = performance.now();

	const pentagonResultStart = performance.now();
	const pentagonResults: InferredValue[] = [];
	for(const nodeId of pentagonVisitor.getAbstractTrace().keys()) {
		const value = pentagonVisitor.getAbstractValue(nodeId);
		if(value !== undefined) {
			const node = ast.idMap.get(nodeId);

			pentagonResults.push({
				nodeId:             nodeId,
				inferredValue:      value.toString() ?? 'undefined',
				significantFigures: value.value.interval.significantFigures?.toString() ?? 'unknown',
				sourceLocation:     SourceRange.fromNode(node)?.toString() ?? 'unknown',
				lexeme:             node?.lexeme ?? 'unknown',
				dfgTag:             dfg.getVertex(nodeId)?.tag ?? 'unknown',
			});
		}
	}
	const pentagonResultEnd = performance.now();

	// Dump Pentagon Results
	const pentagonPath = path.join(outputDirectory, pentagonResultFile);
	fs.rmSync(pentagonPath, { recursive: true, force: true });
	superBigJsonStringify(pentagonResults, '\n', (msg) => fs.appendFileSync(pentagonPath, msg));

	// Create File and Runtime Metadata
	const metadataStart = performance.now();
	const constants = dfg.verticesOfType(VertexType.Value).toArray();
	const numberConstants = constants.filter(value => ast.idMap.get(value[0])?.type === RType.Number);

	const functionCalls = dfg.verticesOfType(VertexType.FunctionCall).toArray();
	const supportedExpressionFunctionCalls = functionCalls.filter(([_, dfgCall]) =>
		IntervalExpressionSemanticsMapper().find(([id]) => Identifier.matches(id, dfgCall.name)) !== undefined ||
		PentagonExpressionSemanticsMapper.find(([id]) => Identifier.matches(id, dfgCall.name)) !== undefined
	);
	const supportedConditionFunctionCalls = functionCalls.filter(([_, dfgCall]) =>
		IntervalSemanticsMaper().find(([id]) => Identifier.matches(id, dfgCall.name)) !== undefined ||
		UpperBoundsSemanticsMapper().find(([id]) => Identifier.matches(id, dfgCall.name)) !== undefined ||
		['&&', '!', '||', '&', '|'].some(id => Identifier.matches(id, dfgCall.name))
	);
	const conditions = functionCalls.filter(([_, dfgCall]) =>
		dfgCall.origin.includes(BuiltInProcName.IfThenElse) || dfgCall.origin.includes(BuiltInProcName.WhileLoop) || dfgCall.origin.includes(BuiltInProcName.StopIfNot)
	);
	const functionsWithUnknownSideEffects = functionCalls.filter(([_, dfgCall]) => UnsupportedFunctions.isUnsupportedCall(dfgCall));

	const deadCodeQueryResult = await analyzer.query([{
		type:  'linter',
		rules: ['dead-code']
	}]);
	const deadCodeResult = deadCodeQueryResult.linter.results['dead-code'] as LintingResultsSuccess<'dead-code'>;
	const linterDeadNodes = deadCodeResult.results.reduce((acc: NodeId[], val) => acc.concat(val.involvedId ?? []), []);


	const metadataEnd = performance.now();

	const fileMetadata: FileMetadata = {
		fileName:                               fileName,
		intervalResultFileName:                 intervalResultFile,
		pentagonResultFileName:                 pentagonResultFile,
		loc:                                    analyzer.inspectContext().files.getAllFiles()[0].content().toString().split('\n').length,
		cloc:                                   analyzer.inspectContext().files.getAllFiles()[0].content().toString().split('\n').filter(line => line.trim() !== '' && !line.trimStart().startsWith('#')).length,
		numOfDfgNodes:                          dfg.vertices(true).toArray().length,
		numOfCfgNodes:                          cfg.graph.vertices(false).size,
		numOfConstants:                         constants.length,
		numOfRNumberConstants:                  numberConstants.length,
		RNumberConstantNodeIds:                 numberConstants.map(([node]) => node),
		numOfFunctionDefinitions:               dfg.verticesOfType(VertexType.FunctionDefinition).toArray().length,
		numOfFunctionCalls:                     functionCalls.length,
		numOfSupportedExpressionFunctionCalls:  supportedExpressionFunctionCalls.length,
		SupportedExpressionFunctionCallNodeIds: supportedExpressionFunctionCalls.map(([node]) => node),
		numOfSupportedConditionFunctionCalls:   supportedConditionFunctionCalls.length,
		SupportedConditionFunctionCalls:        supportedConditionFunctionCalls.map(([node]) => node),
		numOfConditions:                        conditions.length,
		numOfIfThenElse:                        functionCalls.filter(([_, dfgCall]) => dfgCall.origin.includes(BuiltInProcName.IfThenElse)).length,
		numOfWhile:                             functionCalls.filter(([_, dfgCall]) => dfgCall.origin.includes(BuiltInProcName.WhileLoop)).length,
		numOfStopIfNot:                         functionCalls.filter(([_, dfgCall]) => dfgCall.origin.includes(BuiltInProcName.StopIfNot)).length,
		numOfFnWithUnknownSideEffect:           functionsWithUnknownSideEffects.length,
		linterDeadCodeIds:                      linterDeadNodes,
		metadataGatheringInMs:                  metadataEnd - metadataStart,
		baselineInMs:                           baselineEnd - baselineStart,
		astInMs:                                dfgStart - astStart,
		dfgInMs:                                cfgStart - dfgStart,
		cfgInMs:                                cfgEnd - cfgStart,
		intervalAnalysisInMs:                   intervalEnd - intervalStart,
		intervalResultGatheringInMs:            intervalResultEnd - intervalResultStart,
		pentagonAnalysisInMs:                   pentagonEnd - pentagonStart,
		pentagonResultGatheringInMs:            pentagonResultEnd - pentagonResultStart
	};

	// Dump File and Runtime Metadata
	const fileMetadataPath = path.join(outputDirectory, metadataOutputFile);
	fs.rmSync(fileMetadataPath, { recursive: true, force: true });
	fs.writeFileSync(fileMetadataPath, JSON.stringify(fileMetadata, null, 2));
}();