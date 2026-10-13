import { type AmbientStateAccess, applyAmbientStateAccess } from './built-in-ambient-state';
import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { appendEnvironment } from '../../../../../environments/append';
import { DataflowInformation } from '../../../../../info';
import { DropPathsOption, type FlowrLaxSourcingOptions, InferWorkingDirectory } from '../../../../../../config';
import { processKnownFunctionCall } from '../known-call-handling';
import { removeRQuotes, type RParseRequest, type RParseRequestFromText } from '../../../../../../r-bridge/retriever';
import {
	type IdGenerator,
	type NormalizedAst,
	type ParentInformation,
	sourcedDeterministicCountingIdGenerator
} from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type {
	PotentiallyEmptyRArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import type { NoInfo } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { expensiveTrace, log, LogLevel } from '../../../../../../util/log';
import { normalize, normalizeTreeSitter } from '../../../../../../r-bridge/lang-4.x/ast/parser/json/parser';
import { RShellExecutor } from '../../../../../../r-bridge/shell-executor';
import { guard, isNotUndefined } from '../../../../../../util/assert';
import path from 'path';
import { RPath } from '../../../../../../util/files';
import { GasFeatureKey, GasLevel, GasWikiRef } from '../../../../../../gas';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import type { RProjectFile } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { EdgeType } from '../../../../../graph/edge';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { ControlFlow } from '../../../../control-flow';

/**
 * Infers working directories based on the given option and reference chain
 */
export function inferWdFromScript(option: InferWorkingDirectory, referenceChain: readonly (string | undefined)[]): string[] {
	switch(option) {
		case InferWorkingDirectory.MainScript:
			return referenceChain[0] ? [platformDirname(referenceChain[0])] : [];
		case InferWorkingDirectory.ActiveScript: {
			const active = referenceChain.at(-1);
			return active ? [platformDirname(active)] : [];
		} case InferWorkingDirectory.AnyScript:
			return referenceChain.filter(isNotUndefined).map(platformDirname);
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
	return RPath.basename(p);
}

/**
 * Return the dirname of a path in a platform-agnostic way
 */
export function platformDirname(p: string): string {
	return RPath.dirname(p);
}

function returnPlatformPath(p: string): string {
	return p.replaceAll(AnyPathSeparator, path.sep);
}

/** the replacement rules as patterns, compiled once rather than once per candidate path */
function compileReplacements(replacements: readonly Record<string, string>[]): readonly (readonly [RegExp, string])[][] {
	return replacements.map(replacement => Object.entries(replacement).map(([key, value]) => [new RegExp(key, 'g'), value] as const));
}

function applyReplacements(path: string, replacements: readonly (readonly [RegExp, string])[][]): string[] {
	return replacements.map(replacement => {
		let result = path;
		for(const [pattern, value] of replacement) {
			result = result.replaceAll(pattern, value);
		}
		return result;
	});
}

function candidatePaths(seed: string, dropPaths: DropPathsOption | undefined): string[] {
	if(dropPaths !== DropPathsOption.Once && dropPaths !== DropPathsOption.All) {
		return [seed];
	}
	const basename = platformBasename(seed);
	const tryPaths = [seed, basename];
	if(dropPaths === DropPathsOption.All) {
		const dirs = platformDirname(seed).split(AnyPathSeparator);
		if(dirs.length !== 1 || dirs[0] !== '.') {
			for(let i = 0; i < dirs.length; i++) {
				tryPaths.push(path.join(...dirs.slice(i), basename));
			}
		}
	}
	return tryPaths;
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

	let tryPaths = candidatePaths(seed, resolveSource?.dropPaths);
	if(resolveSource?.applyReplacements) {
		const r = compileReplacements(resolveSource.applyReplacements);
		tryPaths = tryPaths.flatMap(t => applyReplacements(t, r));
	}

	const found = new Set<string>();
	for(const explore of [undefined, ...explorePaths]) {
		for(const tryPath of tryPaths) {
			const effectivePath = explore ? path.join(explore, tryPath) : tryPath;
			const context = data.ctx.files;
			const get = context.exists(effectivePath, capitalization) ?? context.exists(returnPlatformPath(effectivePath), capitalization);
			if(get) {
				found.add(returnPlatformPath(get));
			}
		}
	}
	if(log.settings.minLevel >= LogLevel.Info) {
		log.info(`Found sourced file ${JSON.stringify(seed)} at ${JSON.stringify([...found])}`);
	}
	return [...found];
}

/**
 * Processes a named function call (i.e., not an anonymous function)
 */
export function processSourceCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: {
		/** should this produce an explicit source function call in the graph? */
		includeFunctionCall?: boolean,
		/** should this function call be followed, even when the configuration disables it? */
		forceFollow?:         boolean
		ambient?:             AmbientStateAccess | readonly AmbientStateAccess[]
	}
): DataflowInformation {
	if(args.length !== 1) {
		dataflowLogger.warn(`Expected exactly one argument for source currently, but got ${args.length} instead, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const information = config.includeFunctionCall ?
		processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Source }).information
		: DataflowInformation.initialize(rootId, data);
	const withAmbient = (): DataflowInformation => config.ambient === undefined ? information : applyAmbientStateAccess(information, args, rootId, data, config.ambient);

	const sourceFileArgument = args[0];

	if(!config.forceFollow && data.ctx.config.ignoreSourceCalls) {
		expensiveTrace(dataflowLogger, () => `Skipping source call ${JSON.stringify(sourceFileArgument)} (disabled in config file)`);
		handleUnknownSideEffect(information.graph, information.environment, rootId);
		return withAmbient();
	}

	let sourceFile: string[] | undefined;
	if(sourceFileArgument !== EmptyArgument && RString.is(sourceFileArgument?.value)) {
		sourceFile = [removeRQuotes(sourceFileArgument.lexeme)];
	} else if(sourceFileArgument !== EmptyArgument) {
		sourceFile = NodeValue.knownStringsOf(sourceFileArgument.info.id, data);
	}
	const path = sourceFile?.length === 1 ? removeRQuotes(sourceFile[0]) : undefined;
	const filepath = path ? findSource(data.ctx.config.solver.resolveSource, path, data) : undefined;
	if(filepath !== undefined && filepath.length > 0) {
		let result = information;
		const origCds = data.cds?.slice() ?? [];
		const maybe = !data.ctx.config.solver.resolveSource?.assumeFilesExist || filepath.length > 1;
		const limit = data.ctx.config.solver.resolveSource?.repeatedSourceLimit ?? 0;
		for(const f of filepath) {
			// check if the sourced file has already been dataflow analyzed, and if so, skip it
			const findCount = data.referenceChain.filter(e => e === f).length;
			if(findCount > limit) {
				dataflowLogger.warn(`Found cycle (>=${limit + 1}) in dataflow analysis for ${JSON.stringify(filepath)}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`);
				handleUnknownSideEffect(result.graph, result.environment, rootId);
				continue;
			}
			if(filepath.length > 1) {
				data = { ...data, cds: [...origCds, { id: rootId, when: true, file: f }] };
			}
			const idPrefix = (findCount > 0 ? findCount + '::' : '') + data.ctx.files.relativePath(f);
			const getId = sourcedDeterministicCountingIdGenerator(idPrefix, name.location);
			result = sourceRequest(rootId, { request: 'file', content: f }, data, result, maybe, getId);
		}
		return result;
	}

	expensiveTrace(dataflowLogger, () => `Non-constant argument ${JSON.stringify(sourceFile)} for source is currently not supported, skipping`);
	handleUnknownSideEffect(information.graph, information.environment, rootId);
	return withAmbient();
}

/** the files parsed for an inclusion, a requested file is not among them and its inclusions share its nodes */
const includedFiles = new WeakSet<RProjectFile<unknown>>();

/**
 * Processes a source request with the given dataflow processor information and existing dataflow information
 * Otherwise, this can be an {@link RProjectFile} representing a standalone source file
 */
export function sourceRequest<OtherInfo>(rootId: NodeId, request: RParseRequest | RProjectFile<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, information: DataflowInformation, makeMaybe: boolean, getId?: IdGenerator<NoInfo>, evaluatedByRoot = false): DataflowInformation {
	let dataflow: DataflowInformation;
	let fst: RProjectFile<OtherInfo & ParentInformation>;
	let filePath: string | undefined;

	if('root' in request) {
		fst = request;
		filePath = request.filePath;
	} else {
		const textRequest: { r: RParseRequestFromText, path?: string } | undefined = data.ctx.files.resolveRequest(request);

		if(textRequest === undefined && request.request === 'file') {
			dataflowLogger.warn(`Failed to analyze sourced file ${JSON.stringify(request)}: file does not exist`);
			handleUnknownSideEffect(information.graph, information.environment, rootId);
			return information;
		}
		guard(textRequest !== undefined, `Expected text request to be defined for sourced file ${JSON.stringify(request)}`);
		const ext = textRequest.path ? /\.[^.]*$/.exec(textRequest.path)?.[0].toLowerCase() : undefined;
		if(ext !== undefined && ext !== '.r') {
			expensiveTrace(dataflowLogger, () => `Skipping source of non-R file ${JSON.stringify(textRequest.path)}`);
			handleUnknownSideEffect(information.graph, information.environment, rootId);
			return information;
		}
		const gasLevel = data.ctx.gas.checkGas(GasFeatureKey.Source);
		if(gasLevel >= GasLevel.Critical) {
			dataflowLogger.warn(`Skipping source of ${JSON.stringify(request)} due to resource pressure (gas: critical). See ${GasWikiRef}`);
			handleUnknownSideEffect(information.graph, information.environment, rootId);
			return information;
		} else if(gasLevel >= GasLevel.Problematic) {
			dataflowLogger.warn(`Approaching resource limits for source of ${JSON.stringify(request)} (gas: problematic). See ${GasWikiRef}`);
		}
		const requested = textRequest.path === undefined || data.referenceChain.includes(textRequest.path) ? undefined : data.completeAst.ast.files.find(f => f.filePath === textRequest.path && !includedFiles.has(f));
		if(requested) {
			fst = requested;
		} else {
			const parsed = (!data.parser.async ? data.parser : new RShellExecutor()).parse(textRequest.r, data.ctx);
			const normalized = (typeof parsed !== 'string' ?
				normalizeTreeSitter({ files: [{ parsed, filePath: textRequest.path }] }, getId, data.ctx.config)
				: normalize({ files: [{ parsed, filePath: textRequest.path }] }, getId)) as NormalizedAst<OtherInfo & ParentInformation>;
			fst = normalized.ast.files[0];
			includedFiles.add(fst);
			// this can be improved, see issue #628
			for(const [k, v] of normalized.idMap) {
				data.completeAst.idMap.set(k, v);
			}
			if(!data.completeAst.ast.files.some(f => f.filePath === fst.filePath)) {
				data.completeAst.ast.files.push(fst);
			}
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

	// take the entry point as well as all the written references, and give them a control dependency to the source call to show that they are conditional
	if(!String(rootId).startsWith('file-')) {
		if(evaluatedByRoot) {
			/* the call evaluates the code and builds its result from it, so the value flows into the call */
			for(const exit of dataflow.exitPoints) {
				dataflow.graph.addEdge(rootId, exit.nodeId, EdgeType.Reads);
			}
		} else {
			const ids = dataflow.out.map(o => o.nodeId);
			if(dataflow.graph.hasVertex(dataflow.entryPoint)) {
				ids.unshift(dataflow.entryPoint);
			}
			for(const id of ids) {
				if(makeMaybe) {
					dataflow.graph.addControlDependency(id, rootId, true);
				} else {
					dataflow.graph.addEdge(id, rootId, EdgeType.Reads);
				}
			}
		}
	}

	data.ctx.files.addConsideredFile(filePath ?? '<inline>');

	const graph = information.graph.mergeWith(dataflow.graph);
	ControlFlow.continuesWith(graph, information, ControlFlow.entryOf(dataflow));

	return {
		...information,
		environment:       overwriteEnvironment(information.environment, dataflow.environment),
		graph,
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
	if(data.referenceChain.some(e => e !== undefined && e === file.filePath)) {
		dataflowLogger.info(`Found loop in dataflow analysis for ${JSON.stringify(file.filePath)}: ${JSON.stringify(data.referenceChain)}, skipping further dataflow analysis`);
		handleUnknownSideEffect(information.graph, information.environment, file.root.info.id);
		return information;
	}

	return sourceRequest('file-' + idx, file, {
		...data,
		environment:    information.environment,
		referenceChain: [file.filePath]
	}, information, false);
}

/**
 * Folds the results of analyzing sourced code back into the information of the call that asked for it, which
 * `eval` and the string templates both need: the code contributes everything it reads, writes, and leaves open.
 */
export function mergeSourced(information: DataflowInformation, sourced: readonly DataflowInformation[]): DataflowInformation {
	if(sourced.length === 0) {
		return information;
	}
	/* the control flow into the evaluated code is wired by `sourceRequest`, which analyzed it */
	return {
		...information,
		graph:             sourced.reduce((acc, r) => acc.mergeWith(r.graph), information.graph),
		environment:       sourced.reduce((acc, r) => appendEnvironment(acc, r.environment), information.environment),
		in:                information.in.concat(sourced.flatMap(r => r.in)),
		out:               information.out.concat(sourced.flatMap(r => r.out)),
		unknownReferences: information.unknownReferences.concat(sourced.flatMap(r => r.unknownReferences)),
		exitPoints:        information.exitPoints.concat(sourced.flatMap(r => r.exitPoints)),
		hooks:             information.hooks.concat(sourced.flatMap(r => r.hooks))
	};
}
