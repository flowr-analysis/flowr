import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { initializeCleanDataflowInformation } from '../../../../../info';
import { getConfig } from '../../../../../../config';
import { processKnownFunctionCall } from '../known-call-handling';
import type { RParseRequestProvider, RParseRequest } from '../../../../../../r-bridge/retriever';
import {  requestFingerprint , removeRQuotes , requestProviderFromFile } from '../../../../../../r-bridge/retriever';
import type {
	IdGenerator,
	NormalizedAst,
	ParentInformation
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	deterministicPrefixIdGenerator,
	sourcedDeterministicCountingIdGenerator
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import type { NoInfo } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { expensiveTrace } from '../../../../../../util/log';
import fs from 'fs';
import { normalize, normalizeTreeSitter } from '../../../../../../r-bridge/lang-4.x/ast/parser/json/parser';
import { RShellExecutor } from '../../../../../../r-bridge/shell-executor';
import { resolveValueOfVariable } from '../../../../../environments/resolve-by-name';
import { isNotUndefined } from '../../../../../../util/assert';

let sourceProvider = requestProviderFromFile();

export function setSourceProvider(provider: RParseRequestProvider): void {
	sourceProvider = provider;
}

export function processSourceCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: {
		/** should this produce an explicit source function call in the graph? */
		includeFunctionCall?: boolean,
		/** should this function call be followed, even when the configuration disables it? */
		forceFollow?:         boolean
	}
): DataflowInformation {
	const information = config.includeFunctionCall ?
		processKnownFunctionCall({ name, args, rootId, data }).information
		: initializeCleanDataflowInformation(rootId, data);

	const sourceFileArgument = args[0];

	if(!config.forceFollow && getConfig().ignoreSourceCalls) {
		expensiveTrace(dataflowLogger, () => `Skipping source call ${JSON.stringify(sourceFileArgument)} (disabled in config file)`);
		information.graph.markIdForUnknownSideEffects(rootId);
		return information;
	}

	let sourceFile: string[] | undefined;

	if(sourceFileArgument !== EmptyArgument && sourceFileArgument?.value?.type === RType.String) {
		sourceFile = [removeRQuotes(sourceFileArgument.lexeme)];
	} else if(sourceFileArgument !== EmptyArgument) {
		sourceFile = resolveValueOfVariable(sourceFileArgument.value?.lexeme, data.environment, data.completeAst.idMap)?.map(x => {
			if(typeof x === 'object' && x && 'str' in x) {
				return x.str as string;
			} else {
				return undefined;
			}
		}).filter(isNotUndefined);
	}

	if(sourceFile && sourceFile.length === 1) {
		const path = removeRQuotes(sourceFile[0]);
		const request = sourceProvider.createRequest(path);

		// check if the sourced file has already been dataflow analyzed, and if so, skip it
		if(data.referenceChain.includes(requestFingerprint(request))) {
			expensiveTrace(dataflowLogger, () => `Found loop in dataflow analysis for ${JSON.stringify(request)}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`);
			information.graph.markIdForUnknownSideEffects(rootId);
			return information;
		}

		return sourceRequest(rootId, request, data, information, sourcedDeterministicCountingIdGenerator(path, name.location));
	} else {
		expensiveTrace(dataflowLogger, () => `Non-constant argument ${JSON.stringify(sourceFile)} for source is currently not supported, skipping`);
		information.graph.markIdForUnknownSideEffects(rootId);
		return information;
	}
}

export function sourceRequest<OtherInfo>(rootId: NodeId, request: RParseRequest, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, information: DataflowInformation, getId: IdGenerator<NoInfo>): DataflowInformation {
	if(request.request === 'file') {
		/* check if the file exists and if not, fail */
		if(!fs.existsSync(request.content)) {
			dataflowLogger.warn(`Failed to analyze sourced file ${JSON.stringify(request)}: file does not exist`);
			information.graph.markIdForUnknownSideEffects(rootId);
			return information;
		}
	}

	// parse, normalize and dataflow the sourced file
	let normalized: NormalizedAst<OtherInfo & ParentInformation>;
	let dataflow: DataflowInformation;
	try {
		const file = request.request === 'file' ? request.content : undefined;
		const parsed = (!data.parser.async ? data.parser : new RShellExecutor()).parse(request);
		normalized = (typeof parsed !== 'string' ?
			normalizeTreeSitter({ parsed }, getId, file) : normalize({ parsed }, getId, file)) as NormalizedAst<OtherInfo & ParentInformation>;
		dataflow = processDataflowFor(normalized.ast, {
			...data,
			currentRequest: request,
			environment:    information.environment,
			referenceChain: [...data.referenceChain, requestFingerprint(request)]
		});
	} catch(e) {
		dataflowLogger.warn(`Failed to analyze sourced file ${JSON.stringify(request)}, skipping: ${(e as Error).message}`);
		information.graph.markIdForUnknownSideEffects(rootId);
		return information;
	}

	// take the entry point as well as all the written references, and give them a control dependency to the source call to show that they are conditional
	if(dataflow.graph.hasVertex(dataflow.entryPoint)) {
		dataflow.graph.addControlDependency(dataflow.entryPoint, rootId, true);
	}
	for(const out of dataflow.out) {
		dataflow.graph.addControlDependency(out.nodeId, rootId, true);
	}

	// update our graph with the sourced file's information
	const newInformation = { ...information };
	newInformation.environment = overwriteEnvironment(information.environment, dataflow.environment);
	newInformation.graph.mergeWith(dataflow.graph);
	// this can be improved, see issue #628
	for(const [k, v] of normalized.idMap) {
		data.completeAst.idMap.set(k, v);
	}
	return newInformation;
}


export function standaloneSourceFile<OtherInfo>(
	inputRequest: RParseRequest,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	uniqueSourceId: string,
	information: DataflowInformation
): DataflowInformation {
	const path = inputRequest.request === 'file' ? inputRequest.content : '-inline-';
	/* this way we can still pass content */
	const request = inputRequest.request === 'file' ? sourceProvider.createRequest(inputRequest.content) : inputRequest;
	const fingerprint = requestFingerprint(request);

	// check if the sourced file has already been dataflow analyzed, and if so, skip it
	if(data.referenceChain.includes(fingerprint)) {
		dataflowLogger.info(`Found loop in dataflow analysis for ${JSON.stringify(request)}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`);
		information.graph.markIdForUnknownSideEffects(uniqueSourceId);
		return information;
	}

	return sourceRequest(uniqueSourceId, request, {
		...data,
		currentRequest: request,
		environment:    information.environment,
		referenceChain: [...data.referenceChain, fingerprint]
	}, information, deterministicPrefixIdGenerator(path + '@' + uniqueSourceId));
}
