import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { type DataflowInformation, initializeCleanDataflowInformation } from '../../../../../info';
import { DropPathsOption, type FlowrLaxSourcingOptions, InferWorkingDirectory } from '../../../../../../config';
import { processKnownFunctionCall } from '../known-call-handling';
import { removeRQuotes, type RParseRequest, type RParseRequestFromText } from '../../../../../../r-bridge/retriever';
import {
	type IdGenerator,
	type NormalizedAst,
	type ParentInformation,
	sourcedDeterministicCountingIdGenerator
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	EmptyArgument,
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import type { NoInfo } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { expensiveTrace, log, LogLevel } from '../../../../../../util/log';
import { normalize, normalizeTreeSitter } from '../../../../../../r-bridge/lang-4.x/ast/parser/json/parser';
import { RShellExecutor } from '../../../../../../r-bridge/shell-executor';
import { guard, isNotUndefined } from '../../../../../../util/assert';
import path from 'path';
import { valueSetGuard } from '../../../../../eval/values/general';
import { isValue } from '../../../../../eval/values/r-value';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import type { RProjectFile } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-project';

/**
 * Infers working directories based on the given option and reference chain
 */
export function inferWdFromScript(option: InferWorkingDirectory, referenceChain: readonly (string | undefined)[]): string[] {
	switch(option) {
		case InferWorkingDirectory.MainScript:
			return referenceChain[0] ? [platformDirname(referenceChain[0])] : [];
		case InferWorkingDirectory.ActiveScript: {
			const secondToLast = referenceChain[referenceChain.length - 1];
			return secondToLast ? [platformDirname(secondToLast)] : [];
		} case InferWorkingDirectory.AnyScript:
			return referenceChain.filter(isNotUndefined).map(e => platformDirname(e));
		case InferWorkingDirectory.No:
		default:
			return [];
	}
}

const AnyPathSeparator = /[/\\]/g;

/**
 * Return the basename of a path in a platform-agnostic way
 * @see {@link platformDirname} - for the dirname counterpart
 */
export function platformBasename(p: string): string {
	const normalized = p.replaceAll(path.win32.sep, path.posix.sep);
	return path.posix.basename(normalized);
}

/**
 * Return the dirname of a path in a platform-agnostic way
 */
export function platformDirname(p: string): string {
	const normalized = p.replaceAll(path.win32.sep, path.posix.sep);
	return path.posix.dirname(normalized);
}

function returnPlatformPath(p: string): string {
	return p.replaceAll(AnyPathSeparator, path.sep);
}

function applyReplacements(path: string, replacements: readonly Record<string, string>[]): string[] {
	const results = [];
	for(const replacement of replacements) {
		const newPath = Object.entries(replacement).reduce((acc, [key, value]) => acc.replace(new RegExp(key, 'g'), value), path);
		results.push(newPath);
	}

	return results;
}

/**
 * Tries to find sourced by a source request and returns the first path that exists
 * @param resolveSource - options for lax file sourcing
 * @param seed          - the path originally requested in the `source` call
 * @param data          - more information on the loading context
 */
export function findSource(
	resolveSource: FlowrLaxSourcingOptions | undefined,
	seed: string,
	data: { referenceChain: readonly (string | undefined)[], ctx: ReadOnlyFlowrAnalyzerContext },
): string[] | undefined {
	const capitalization = resolveSource?.ignoreCapitalization ?? false;

	const explorePaths = (resolveSource?.searchPath ?? []).concat(
		inferWdFromScript(resolveSource?.inferWorkingDirectory ?? InferWorkingDirectory.No, data.referenceChain)
	);

	let tryPaths = [seed];
	switch(resolveSource?.dropPaths ?? DropPathsOption.No) {
		case DropPathsOption.Once: {
			const first = platformBasename(seed);
			tryPaths.push(first);
			break;
		}
		case DropPathsOption.All: {
			const paths = platformDirname(seed).split(AnyPathSeparator);
			const basename = platformBasename(seed);
			tryPaths.push(basename);
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

	if(resolveSource?.applyReplacements) {
		const r = resolveSource.applyReplacements;
		tryPaths = tryPaths.flatMap(t => applyReplacements(t, r));
	}

	const found: string[] = [];
	for(const explore of [undefined, ...explorePaths]) {
		for(const tryPath of tryPaths) {
			const effectivePath = explore ? path.join(explore, tryPath) : tryPath;
			const context = data.ctx.files;
			const get = context.exists(effectivePath, capitalization) ?? context.exists(returnPlatformPath(effectivePath), capitalization);

			if(get && !found.includes(effectivePath)) {
				found.push(returnPlatformPath(effectivePath));
			}
		}
	}
	if(log.settings.minLevel >= LogLevel.Info) {
		log.info(`Found sourced file ${JSON.stringify(seed)} at ${JSON.stringify(found)}`);
	}
	return found;
}

/**
 * Processes a named function call (i.e., not an anonymous function)
 */
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

	if(!config.forceFollow && data.ctx.config.ignoreSourceCalls) {
		expensiveTrace(dataflowLogger, () => `Skipping source call ${JSON.stringify(sourceFileArgument)} (disabled in config file)`);
		handleUnknownSideEffect(information.graph, information.environment, rootId);
		return information;
	}

	let sourceFile: string[] | undefined;

	if(sourceFileArgument !== EmptyArgument && sourceFileArgument?.value?.type === RType.String) {
		sourceFile = [removeRQuotes(sourceFileArgument.lexeme)];
	} else if(sourceFileArgument !== EmptyArgument) {
		const resolved = valueSetGuard(resolveIdToValue(sourceFileArgument.info.id, { environment: data.environment, idMap: data.completeAst.idMap, resolve: data.ctx.config.solver.variables, ctx: data.ctx }));
		sourceFile = resolved?.elements.map(r => r.type === 'string' && isValue(r.value) ? r.value.str : undefined).filter(isNotUndefined);
	}

	if(sourceFile && sourceFile.length === 1) {
		const path = removeRQuotes(sourceFile[0]);
		let filepath = path ? findSource(data.ctx.config.solver.resolveSource, path, data) : path;

		if(Array.isArray(filepath)) {
			filepath = filepath?.[0];
		}
		if(filepath !== undefined) {
			// check if the sourced file has already been dataflow analyzed, and if so, skip it
			const limit = data.ctx.config.solver.resolveSource?.repeatedSourceLimit ?? 0;
			const findCount = data.referenceChain.filter(e => e !== undefined && filepath === e).length;
			if(findCount > limit) {
				dataflowLogger.warn(`Found cycle (>=${limit + 1}) in dataflow analysis for ${JSON.stringify(filepath)}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`);
				handleUnknownSideEffect(information.graph, information.environment, rootId);
				return information;
			}

			return sourceRequest(rootId, { request: 'file', content: filepath }, data, information, sourcedDeterministicCountingIdGenerator((findCount > 0 ? findCount + '::' : '') + path, name.location));
		}
	}

	expensiveTrace(dataflowLogger, () => `Non-constant argument ${JSON.stringify(sourceFile)} for source is currently not supported, skipping`);
	handleUnknownSideEffect(information.graph, information.environment, rootId);
	return information;
}

/**
 * Processes a source request with the given dataflow processor information and existing dataflow information
 * Otherwise, this can be an {@link RProjectFile} representing a standalone source file
 */
export function sourceRequest<OtherInfo>(rootId: NodeId, request: RParseRequest | RProjectFile<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, information: DataflowInformation, getId?: IdGenerator<NoInfo>): DataflowInformation {
	// parse, normalize and dataflow the sourced file
	let dataflow: DataflowInformation;
	let fst: RProjectFile<OtherInfo & ParentInformation>;
	let filePath: string | undefined;

	if('root' in request) {
		fst = request;
		filePath = request.filePath;
	} else {
		const textRequest: { r: RParseRequestFromText, path?: string } | undefined = data.ctx.files.resolveRequest(request);

		if(textRequest === undefined && request.request === 'file') {
			// if translation failed there is nothing we can do!!
			dataflowLogger.warn(`Failed to analyze sourced file ${JSON.stringify(request)}: file does not exist`);
			handleUnknownSideEffect(information.graph, information.environment, rootId);
			return information;
		} else {
			guard(textRequest !== undefined, `Expected text request to be defined for sourced file ${JSON.stringify(request)}`);
		}
		const parsed = (!data.parser.async ? data.parser : new RShellExecutor()).parse(textRequest.r);
		const normalized = (typeof parsed !== 'string' ?
			normalizeTreeSitter({ files: [{ parsed, filePath: textRequest.path }] }, getId, data.ctx.config)
			: normalize({ files: [{ parsed, filePath: textRequest.path }] }, getId)) as NormalizedAst<OtherInfo & ParentInformation>;
		fst = normalized.ast.files[0];
		// this can be improved, see issue #628
		for(const [k, v] of normalized.idMap) {
			data.completeAst.idMap.set(k, v);
		}
		// add to the main ast
		if(!data.completeAst.ast.files.find(f => f.filePath === fst.filePath)) {
			data.completeAst.ast.files.push(fst);
		}
		filePath = textRequest.path;
	}

	try {
		dataflow = processDataflowFor(fst.root, {
			...data,
			environment:    information.environment,
			referenceChain: [...data.referenceChain, fst.filePath]
		});
	} catch(e) {
		dataflowLogger.error(`Failed to analyze sourced file ${JSON.stringify(request)}, skipping: ${(e as Error).message}`);
		dataflowLogger.error((e as Error).stack);
		handleUnknownSideEffect(information.graph, information.environment, rootId);
		return information;
	}

	return dataflow;

	// take the entry point as well as all the written references, and give them a control dependency to the source call to show that they are conditional
	if(!String(rootId).startsWith('file-')) {
		if(dataflow.graph.hasVertex(dataflow.entryPoint)) {
			dataflow.graph.addControlDependency(dataflow.entryPoint, rootId, true);
		}
		for(const out of dataflow.out) {
			dataflow.graph.addControlDependency(out.nodeId, rootId, true);
		}
	}

	data.ctx.files.addConsideredFile(filePath ?? '<inline>');

	// update our graph with the sourced file's information

	return {
		...information,
		environment:       overwriteEnvironment(information.environment, dataflow.environment),
		graph:             information.graph.mergeWith(dataflow.graph),
		in:                information.in.concat(dataflow.in),
		out:               information.out.concat(dataflow.out),
		unknownReferences: information.unknownReferences.concat(dataflow.unknownReferences),
		exitPoints:        dataflow.exitPoints
	};
}

/**
 *
 */
export function mergeDataflowInformation<OtherInfo>(rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
																																																				filePath: string | undefined, information: DataflowInformation, dataflow: DataflowInformation
): DataflowInformation{

	// take the entry point as well as all the written references, and give them a control dependency to the source call to show that they are conditional
	if(!String(rootId).startsWith('file-')) {
		if(dataflow.graph.hasVertex(dataflow.entryPoint)) {
			dataflow.graph.addControlDependency(dataflow.entryPoint, rootId, true);
		}
		for(const out of dataflow.out) {
			dataflow.graph.addControlDependency(out.nodeId, rootId, true);
		}
	}

	data.ctx.files.addConsideredFile(filePath ?? '<inline>');

	// update our graph with the sourced file's information

	return {
		...information,
		environment:       overwriteEnvironment(information.environment, dataflow.environment),
		graph:             information.graph.mergeWith(dataflow.graph),
		in:                information.in.concat(dataflow.in),
		out:               information.out.concat(dataflow.out),
		unknownReferences: information.unknownReferences.concat(dataflow.unknownReferences),
		exitPoints:        dataflow.exitPoints
	};
}

/**
 * Processes a standalone source file (i.e., not from a source function call)
 */
export function standaloneSourceFile<OtherInfo>(
	idx: number,
	file: RProjectFile<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	information: DataflowInformation
): DataflowInformation {
	// check if the sourced file has already been dataflow analyzed, and if so, skip it
	if(data.referenceChain.find(e => e !== undefined && e === file.filePath)) {
		dataflowLogger.info(`Found loop in dataflow analysis for ${JSON.stringify(file.filePath)}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`);
		handleUnknownSideEffect(information.graph, information.environment, file.root.info.id);
		return information;
	}

	return sourceRequest('file-' + idx, file, {
		...data,
		environment:    information.environment,
		referenceChain: [...data.referenceChain, file.filePath]
	}, information);
}
