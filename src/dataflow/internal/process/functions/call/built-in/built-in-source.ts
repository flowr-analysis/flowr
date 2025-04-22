import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { initializeCleanDataflowInformation } from '../../../../../info';
import { DropPathsOption, getConfig, InferWorkingDirectory } from '../../../../../../config';
import { processKnownFunctionCall } from '../known-call-handling';
import type { RParseRequest, RParseRequestProvider } from '../../../../../../r-bridge/retriever';
import { removeRQuotes, requestProviderFromFile } from '../../../../../../r-bridge/retriever';
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
import { expensiveTrace, log } from '../../../../../../util/log';
import fs from 'fs';
import { normalize, normalizeTreeSitter } from '../../../../../../r-bridge/lang-4.x/ast/parser/json/parser';
import { RShellExecutor } from '../../../../../../r-bridge/shell-executor';
import { resolveValueOfVariable } from '../../../../../environments/resolve-by-name';
import { isNotUndefined } from '../../../../../../util/assert';
import path from 'path';
import { valueSetGuard } from '../../../../../eval/values/general';
import { isValue } from '../../../../../eval/values/r-value';

let sourceProvider = requestProviderFromFile();

export function setSourceProvider(provider: RParseRequestProvider): void {
	sourceProvider = provider;
}


export function inferWdFromScript(option: InferWorkingDirectory, referenceChain: readonly RParseRequest[]): string[] {
	switch(option) {
		case InferWorkingDirectory.MainScript:
			return referenceChain[0]?.request === 'file' ? [platformDirname(referenceChain[0].content)] : [];
		case InferWorkingDirectory.ActiveScript:
			return referenceChain[referenceChain.length - 1] ? [platformDirname(referenceChain[referenceChain.length - 1].content)] : [];
		case InferWorkingDirectory.AnyScript:
			return referenceChain.filter(e => e.request === 'file').map(e => platformDirname(e.content));
		case InferWorkingDirectory.No:
		default:
			return [];
	}
}

const AnyPathSeparator = /[/\\]/g;

function platformBasename(p: string): string {
	const normalized = p.replaceAll(path.win32.sep, path.posix.sep);
	return path.posix.basename(normalized);
}
function platformDirname(p: string): string {
	const normalized = p.replaceAll(path.win32.sep, path.posix.sep);
	return path.posix.dirname(normalized);
}

function returnPlatformPath(p: string): string {
	return p.replaceAll(AnyPathSeparator, path.sep);
}

/**
 * Tries to find sourced by a source request and returns the first path that exists
 * @param seed - the path originally requested in the `source` call
 * @param data - more information on the loading context
 */
export function findSource(seed: string, data: { referenceChain: readonly RParseRequest[] }): string[] | undefined {
	const config = getConfig().solver.resolveSource;
	const capitalization = config?.ignoreCapitalization ?? false;

	const explorePaths = [
		...(config?.searchPath ?? []),
		...(inferWdFromScript(config?.inferWorkingDirectory ?? InferWorkingDirectory.No, data.referenceChain))
	];

	const tryPaths = [seed];
	switch(config?.dropPaths ?? DropPathsOption.No) {
		case DropPathsOption.Once: {
			const first = platformBasename(seed);
			tryPaths.push(first);
			break;
		}
		case DropPathsOption.All: {
			const paths = platformDirname(seed).split(AnyPathSeparator);
			const basename = platformBasename(seed);
			if(paths.length === 1 && paths[0] === '.') {
				break;
			}
			for(let i = 0; i < paths.length; i++) {
				tryPaths.push(path.join(...paths.slice(i), basename));
			}
			break;
		}
		default:
		case DropPathsOption.No:
			break;
	}

	const found: string[] = [];
	for(const explore of [undefined, ...explorePaths]) {
		for(const tryPath of tryPaths) {
			const effectivePath = explore ? path.join(explore, tryPath) : tryPath;

			const get = sourceProvider.exists(effectivePath, capitalization) ?? sourceProvider.exists(returnPlatformPath(effectivePath), capitalization);

			if(get && !found.includes(effectivePath)) {
				found.push(returnPlatformPath(effectivePath));
			}
		}
	}
	log.info(`Found sourced file ${JSON.stringify(seed)} at ${JSON.stringify(found)}`);
	return found;
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
	if(args.length !== 1) {
		dataflowLogger.warn(`Expected exactly one argument for source currently, but got ${args.length} instead, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const information = config.includeFunctionCall ?
		processKnownFunctionCall({ name, args, rootId, data, origin: 'builtin:source' }).information
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
		const resolved = valueSetGuard(resolveValueOfVariable(sourceFileArgument.value?.lexeme, data.environment, data.completeAst.idMap));
		sourceFile = resolved?.elements.map(r => r.type === 'string' && isValue(r.value) ? r.value.str : undefined).filter(isNotUndefined);
	}

	if(sourceFile && sourceFile.length === 1) {
		const path = removeRQuotes(sourceFile[0]);
		let filepath = path ? findSource(path, data) : path;

		if(Array.isArray(filepath)) {
			filepath = filepath?.[0];
		}
		if(filepath !== undefined) {
			const request = sourceProvider.createRequest(filepath);

			// check if the sourced file has already been dataflow analyzed, and if so, skip it
			const limit = getConfig().solver.resolveSource?.repeatedSourceLimit ?? 0;
			const findCount = data.referenceChain.filter(e => e.request === request.request && e.content === request.content).length;
			if(findCount > limit) {
				dataflowLogger.warn(`Found cycle (>=${limit + 1}) in dataflow analysis for ${JSON.stringify(request)}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`);
				information.graph.markIdForUnknownSideEffects(rootId);
				return information;
			}

			return sourceRequest(rootId, request, data, information, sourcedDeterministicCountingIdGenerator((findCount > 0 ? findCount + '::' : '') + path, name.location));
		}
	}

	expensiveTrace(dataflowLogger, () => `Non-constant argument ${JSON.stringify(sourceFile)} for source is currently not supported, skipping`);
	information.graph.markIdForUnknownSideEffects(rootId);
	return information;
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
			referenceChain: [...data.referenceChain, request]
		});
	} catch(e) {
		dataflowLogger.error(`Failed to analyze sourced file ${JSON.stringify(request)}, skipping: ${(e as Error).message}`);
		dataflowLogger.error((e as Error).stack);
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

	dataflow.graph.addFile(request.request === 'file' ? request.content : '<inline>');

	// update our graph with the sourced file's information
	const newInformation = { ...information };
	newInformation.environment = overwriteEnvironment(information.environment, dataflow.environment);
	newInformation.graph.mergeWith(dataflow.graph);
	// this can be improved, see issue #628
	for(const [k, v] of normalized.idMap) {
		data.completeAst.idMap.set(k, v);
	}
	return {
		...newInformation,
		in:                newInformation.in.concat(dataflow.in),
		out:               newInformation.out.concat(dataflow.out),
		unknownReferences: newInformation.unknownReferences.concat(dataflow.unknownReferences),
		exitPoints:        dataflow.exitPoints
	};
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

	// check if the sourced file has already been dataflow analyzed, and if so, skip it
	if(data.referenceChain.find(e => e.request === request.request && e.content === request.content)) {
		dataflowLogger.info(`Found loop in dataflow analysis for ${JSON.stringify(request)}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`);
		information.graph.markIdForUnknownSideEffects(uniqueSourceId);
		return information;
	}

	return sourceRequest(uniqueSourceId, request, {
		...data,
		currentRequest: request,
		environment:    information.environment,
		referenceChain: [...data.referenceChain, inputRequest]
	}, information, deterministicPrefixIdGenerator(path + '::' + uniqueSourceId));
}
