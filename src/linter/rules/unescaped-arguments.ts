import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';
import { Identifier, PkgName } from '../../dataflow/environments/identifier';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { FunctionCallVertex } from '../../dataflow/graph/vertex';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { CallTargets } from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { FunctionArgInfo, FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { narrowingFunctions } from '../../queries/catalog/input-sources-query/input-source-functions';
import type { InputSource, InputSources } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { InputTraceType, InputType } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FlowrSearchElement } from '../../search/flowr-search';
import { Q } from '../../search/flowr-search-builder';
import { SlicingCriterion } from '../../slicing/criterion/parse';
import { DotsParameterName, matchArgumentsToParameters } from '../../util/arg-matching';
import { isNotUndefined } from '../../util/assert';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import { Record } from '../../util/record';
import type { LintingResult, LintingRule, LintQuickFix } from '../linter-format';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';

/**
 * The kinds of critical operations to check for unescaped arguments.
 */
export enum UnescapedArgumentCategory {
	/** Functions performing system commands, e.g. `system` */
	System = 'system',
	/** Functions dynamically evaluating R code, e.g. `eval` */
	Eval = 'eval',
	/** Functions querying databases, e.g. `dbGetQuery` */
	Database = 'database',
	/** Functions producing raw HTML or JavaScript, e.g. Shiny `HTML` */
	Html = 'html'
}

const UnescapedArgumentCategories: readonly UnescapedArgumentCategory[] = Record.values(UnescapedArgumentCategory);

const CategoryReaches: Record<UnescapedArgumentCategory, string> = {
	[UnescapedArgumentCategory.System]:   'a system command',
	[UnescapedArgumentCategory.Eval]:     'an evaluation of R code',
	[UnescapedArgumentCategory.Database]: 'a database query',
	[UnescapedArgumentCategory.Html]:     'raw HTML/JavaScript output'
};

/** Maximum depth to descent to find unescaped part of argument */
const MaxDescentDepth = 5;

/** Input types that are considered to be safe */
const AcceptedInputs: readonly InputType[] = [InputType.Constant, InputType.DerivedConstant];

/** Input types that may be critical (uncertain) */
const UncertainInputs: readonly InputType[] = [InputType.Unknown, InputType.Parameter, InputType.Scope];

/** A quick fix to escape an unescaped expression */
export interface EscapeQuickFix extends MergeableRecord {
	/** The escape function the unescaped expression should be wrapped in */
	readonly call:       Identifier;
	/** The argument of the critical function to use as first argument for the escape function */
	readonly firstArg?:  FunctionArgInfo;
	/** Whether the fix should only be applied to parts of the critical argument and not the whole argument */
	readonly partsOnly?: boolean;
}

export interface UnescapedArgumentsResult extends LintingResult {
	/** The category of the critical function call */
	category: UnescapedArgumentCategory;
	/** The identifier of the critical function call */
	function: Identifier;
	/** The unescaped input sources reaching the critical function call */
	sources:  InputSources;
}

export interface UnescapedArgumentsMetadata extends MergeableRecord {
	/** The number of critical arguments that were checked */
	totalCriticalArguments: number;
	/** The number of critical arguments that are constant or are already properly escaped */
	totalEscapedArguments:  number;
}

export interface UnescapedArgumentsConfig extends MergeableRecord {
	/**
	 * The categories that should be disabled and not checked
	 * @see {@link UnescapedArgumentCategory}
	 */
	readonly disabledCategories: readonly UnescapedArgumentCategory[];
	/**
	 * The function calls with critical arguments for a category that perform a critical operation
	 * @see {@link FunctionInfo}
	 */
	readonly criticalCalls:      Readonly<Record<UnescapedArgumentCategory, readonly FunctionInfo[]>>;
	/**
	 * The functions that escape an unescaped value for a category
	 */
	readonly sanitizers:         Readonly<Record<UnescapedArgumentCategory, readonly Identifier[]>>;
	/**
	 * The functions to wrap an unescaped expression for a category in as quick fixes
	 * @see {@link EscapeQuickFix}
	 */
	readonly quickFixes:         Readonly<Partial<Record<UnescapedArgumentCategory, EscapeQuickFix>>>;
	/**
	 * The input types that count as already escaped
	 * @see {@link InputType}
	 */
	readonly acceptedInputs:     readonly InputType[];
}

interface CriticalCallEntry {
	readonly category: UnescapedArgumentCategory;
	/** The function performing the critical operation */
	readonly name:     Identifier;
	/** The arguments of the function that carry the critical value */
	readonly args:     readonly FunctionArgInfo[];
}

/** An argument of a critical function call */
interface CriticalTarget {
	readonly category: UnescapedArgumentCategory;
	readonly call:     DataflowGraphVertexFunctionCall;
	readonly arg:      NodeId;
	readonly location: SourceLocation;
}

interface CriticalTargetEntry {
	readonly target: CriticalTarget;
	readonly call:   NodeId;
	readonly only:   ReadonlySet<NodeId> | undefined;
	readonly depth:  number;
}

function getParamNames(args: readonly FunctionArgInfo[]): (string | undefined)[] {
	const formals: (string | undefined)[] = [];

	for(const arg of args) {
		if(typeof arg.argIdx === 'number') {
			formals[arg.argIdx] = arg.argName;
		}
	}
	return Array.from(formals);
}

/** Finds the arguments of the function call matching the critical argument */
function matchArguments(call: DataflowGraphVertexFunctionCall, arg: FunctionArgInfo, known: readonly FunctionArgInfo[]): readonly FunctionArgument[] {
	if(arg.argIdx === undefined && arg.argName === undefined) {
		return call.args;
	} else if(arg.argIdx === 'unnamed') {
		return call.args.filter(FunctionArgument.isUnnamed);
	}
	const formals = getParamNames([...known, arg]);
	const target = arg.argIdx ?? formals.push(DotsParameterName, arg.argName) - 1;
	const bound = matchArgumentsToParameters(call.args.map(FunctionArgument.getName), formals);

	return call.args.filter((_, index) => bound[index] === target);
}

/** Finds the node IDs of the arguments of the function call matching the critical argument */
function findArguments(call: DataflowGraphVertexFunctionCall, arg: FunctionArgInfo, known: readonly FunctionArgInfo[] = []): NodeId[] {
	return matchArguments(call, arg, known).map(FunctionArgument.getReference).filter(isNotUndefined);
}

/** Get the critical calls of every category that is not disabled */
function getEnabledCriticalCalls(config: UnescapedArgumentsConfig): { category: UnescapedArgumentCategory, info: FunctionInfo }[] {
	return UnescapedArgumentCategories
		.filter(category => !config.disabledCategories.includes(category))
		.flatMap(category => (config.criticalCalls[category] ?? []).map(info => ({ category, info })));
}

/** Index the critical calls of the enabled categories by function name */
function indexCriticalCalls(config: UnescapedArgumentsConfig): Map<string, CriticalCallEntry[]> {
	const index = new Map<string, CriticalCallEntry[]>();

	for(const { category, info } of getEnabledCriticalCalls(config)) {
		const args = [info, ...Record.values(info.additionalArgs ?? {})];
		const call = { category, name: Identifier.make(info.name, info.package), args };
		const known = index.get(info.name);

		if(known !== undefined) {
			known.push(call);
		} else {
			index.set(info.name, [call]);
		}
	}
	return index;
}

/** Gets all critical arguments of critical function calls in the data flow graph */
function getCriticalTargets(
	elements: readonly FlowrSearchElement<ParentInformation>[],
	graph: DataflowGraph,
	config: UnescapedArgumentsConfig
): CriticalTarget[] {
	const criticalCalls = indexCriticalCalls(config);
	const targets: CriticalTarget[] = [];
	const seen = new Set<string>();

	for(const { node } of elements) {
		const vertex = graph.getVertex(node.info.id);

		if(!FunctionCallVertex.is(vertex)) {
			continue;
		}
		for(const { category, name, args } of criticalCalls.get(Identifier.getName(vertex.name)) ?? []) {
			if(!Identifier.matches(name, vertex.name) && !Identifier.matches(vertex.name, name)) {
				continue;
			}
			for(const arg of args.flatMap(arg => findArguments(vertex, arg, args))) {
				const location = SourceLocation.fromNode(graph.idMap?.get(arg));
				const key = `${category}-${vertex.id}-${arg}`;

				if(location !== undefined && !seen.has(key)) {
					seen.add(key);
					targets.push({ category, call: vertex, arg, location });
				}
			}
		}
	}
	return targets;
}

function mapInputSourceToArgs(call: DataflowGraphVertexFunctionCall, sources: InputSources): [NodeId, InputSource][] {
	const args = call.args.map(FunctionArgument.getReference).filter(isNotUndefined);
	const result: [NodeId, InputSource][] = [];

	for(let i = 0; i < args.length; i++) {
		const source = sources.find(source => source.id === args[i]) ?? (sources.length === args.length ? sources[i] : undefined);

		if(source !== undefined) {
			result.push([args[i], source]);
		}
	}
	return result;
}

function isAcceptedInput(source: InputSource, config: UnescapedArgumentsConfig): boolean {
	return source.types.every(type => config.acceptedInputs.includes(type));
}

function isCertainlyCritical(source: InputSource, config: UnescapedArgumentsConfig): boolean {
	return source.types.some(type => !config.acceptedInputs.includes(type) && !UncertainInputs.includes(type));
}

/**
 * Gets all unescaped sources for the critical target calls of the given category
 */
async function getUnescapedSources(
	category: UnescapedArgumentCategory,
	targets: readonly CriticalTarget[],
	config: UnescapedArgumentsConfig,
	data: ReadonlyFlowrAnalysisProvider,
	graph: DataflowGraph
): Promise<Map<CriticalTarget, InputSource[]>> {
	const sanitizers = (config.sanitizers[category] ?? []).map(call => ({ call }));
	const queryConfig = { narrowing: [...narrowingFunctions(), ...sanitizers] };
	const found = new Map<CriticalTarget, InputSource[]>();
	let entries: CriticalTargetEntry[] = targets.map(target => ({ target, call: target.call.id, only: new Set([target.arg]), depth: 0 }));

	while(entries.length > 0) {
		const criteria = [...new Set(entries.map(entry => SlicingCriterion.fromId(entry.call)))];
		const queryResult = await data.query([{ type: 'input-sources', criterion: criteria, config: queryConfig }]);
		const classified = queryResult['input-sources']?.results ?? {};
		const next: CriticalTargetEntry[] = [];

		for(const entry of entries) {
			const call = graph.getVertex(entry.call);

			if(!FunctionCallVertex.is(call)) {
				continue;
			}
			for(const [arg, source] of mapInputSourceToArgs(call, classified[SlicingCriterion.fromId(entry.call)] ?? [])) {
				const vertex = graph.getVertex(arg);

				if((entry.only !== undefined && !entry.only.has(arg)) || isAcceptedInput(source, config)) {
					continue;
				} else if(entry.depth < MaxDescentDepth && source.trace === InputTraceType.Known && FunctionCallVertex.is(vertex) && !FunctionCallVertex.hasOrigin(vertex, BuiltInProcName.Access)) {
					next.push({ target: entry.target, call: arg, only: undefined, depth: entry.depth + 1 });
				} else {
					found.set(entry.target, [...(found.get(entry.target) ?? []), { ...source, id: arg }]);
				}
			}
		}
		entries = next;
	}
	return found;
}

/** A fix wrapping the unescaped expression in the escaping function of its category. */
function escapeFix(fix: EscapeQuickFix, target: CriticalTarget, source: InputSource, idMap: AstIdMap): LintQuickFix | undefined {
	const location = SourceLocation.fromNode(idMap.get(source.id));
	const lexeme = RNode.lexeme(idMap.get(source.id));

	if(location === undefined || lexeme === undefined || (fix.partsOnly && source.id === target.arg)) {
		return undefined;
	}
	let leading = '';

	if(fix.firstArg !== undefined) {
		const [arg] = findArguments(target.call, fix.firstArg);
		const first = arg === undefined || arg === target.arg ? undefined : RNode.lexeme(idMap.get(arg));

		if(first === undefined) {
			return undefined;
		}
		leading = `${first}, `;
	}
	const call = Identifier.toString(fix.call);

	return {
		type:        'replace',
		loc:         location,
		description: `Escape the value with \`${call}\``,
		replacement: `${call}(${leading}${lexeme})`
	};
}

function createResult(target: CriticalTarget, sources: InputSource[], config: UnescapedArgumentsConfig, idMap: AstIdMap): UnescapedArgumentsResult {
	const fix = config.quickFixes[target.category];
	const quickFix = fix === undefined ? [] : sources.map(source => escapeFix(fix, target, source, idMap)).filter(isNotUndefined);

	return {
		certainty:  sources.some(source => isCertainlyCritical(source, config)) ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain,
		involvedId: [target.call.id, target.arg],
		loc:        target.location,
		category:   target.category,
		function:   Identifier.toString(target.call.name),
		sources,
		...(quickFix.length > 0 ? { quickFix } : {})
	};
}

function printCriticalInputs(sources: InputSources): string {
	return [...new Set(sources.flatMap(source => source.types).filter(type => !AcceptedInputs.includes(type)))].join(', ');
}

export const UNESCAPED_ARGUMENTS = {
	createSearch: config => Q.fromQuery({
		type:        'call-context',
		callName:    getEnabledCriticalCalls(config).map(({ info }) => info.name),
		callTargets: CallTargets.MustIncludeGlobal
	}),
	processSearchResult: async(elements, config, data) => {
		const idMap = (await data.normalize()).idMap;
		const graph = (await data.dataflow()).graph;
		const targets = getCriticalTargets(elements.getElements(), graph, config);

		const results: UnescapedArgumentsResult[] = [];
		let escaped = 0;

		for(const category of UnescapedArgumentCategories) {
			const categoryTargets = targets.filter(target => target.category === category);

			if(categoryTargets.length === 0) {
				continue;
			}
			const unescaped = await getUnescapedSources(category, categoryTargets, config, data, graph);

			for(const target of categoryTargets) {
				const sources = unescaped.get(target);

				if(sources === undefined) {
					escaped++;
				} else {
					results.push(createResult(target, sources, config, idMap));
				}
			}
		}
		return {
			results,
			'.meta': { totalCriticalArguments: targets.length, totalEscapedArguments: escaped }
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result =>
			`Unescaped ${result.category} argument of \`${Identifier.toString(result.function)}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]: result =>
			`The argument of \`${Identifier.toString(result.function)}\` at ${SourceLocation.format(result.loc)} reaches ${CategoryReaches[result.category]} unescaped (input: ${printCriticalInputs(result.sources)})`
	},
	info: {
		name:          'Unescaped Arguments',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Smell, LintingRuleTag.Shiny, LintingRuleTag.QuickFix],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Detects arguments of critical system, evaluation, database, and HTML/JavaScript calls that are not properly escaped.',
		defaultConfig: {
			disabledCategories: [],
			criticalCalls:      {
				[UnescapedArgumentCategory.System]: [
					{ package: PkgName.Base, name: 'system',          argIdx: 0, argName: 'command' },
					{ package: PkgName.Base, name: 'system2',         argIdx: 0, argName: 'command', additionalArgs: { args: { argIdx: 1, argName: 'args' } } },
					{ package: PkgName.Base, name: 'shell',           argIdx: 0, argName: 'cmd' },
					{ package: PkgName.Base, name: 'shell.exec',      argIdx: 0, argName: 'file' },
					{ package: PkgName.Base, name: 'pipe',            argIdx: 0, argName: 'description' },
					{ package: 'processx',   name: 'run',             argIdx: 0, argName: 'command', additionalArgs: { args: { argIdx: 1, argName: 'args' } } },
					{ package: 'processx',   name: 'process',         argIdx: 0, argName: 'command', additionalArgs: { args: { argIdx: 1, argName: 'args' } } },
					{ package: 'sys',        name: 'exec_wait',       argIdx: 0, argName: 'cmd',     additionalArgs: { args: { argIdx: 1, argName: 'args' } } },
					{ package: 'sys',        name: 'exec_internal',   argIdx: 0, argName: 'cmd',     additionalArgs: { args: { argIdx: 1, argName: 'args' } } },
					{ package: 'sys',        name: 'exec_background', argIdx: 0, argName: 'cmd',     additionalArgs: { args: { argIdx: 1, argName: 'args' } } }
				],
				[UnescapedArgumentCategory.Eval]: [
					{ package: PkgName.Base,  name: 'eval',        argIdx: 0, argName: 'expr' },
					{ package: PkgName.Base,  name: 'evalq',       argIdx: 0, argName: 'expr' },
					{ package: PkgName.Base,  name: 'eval.parent', argIdx: 0, argName: 'expr' },
					{ package: PkgName.Base,  name: 'do.call',     argIdx: 0, argName: 'what' },
					{ package: PkgName.Base,  name: 'get',         argIdx: 0, argName: 'x' },
					{ package: PkgName.Base,  name: 'get0',        argIdx: 0, argName: 'x' },
					{ package: PkgName.Base,  name: 'match.fun',   argIdx: 0, argName: 'FUN' },
					{ package: PkgName.Rlang, name: 'eval_tidy',   argIdx: 0, argName: 'expr' },
					{ package: PkgName.Rlang, name: 'eval_bare',   argIdx: 0, argName: 'expr' }
				],
				[UnescapedArgumentCategory.Database]: [
					{ name: 'dbGetQuery',      argIdx: 1, argName: 'statement' },
					{ name: 'dbSendQuery',     argIdx: 1, argName: 'statement' },
					{ name: 'dbSendStatement', argIdx: 1, argName: 'statement' },
					{ name: 'dbExecute',       argIdx: 1, argName: 'statement' },
					{ package: 'sqldf',       name: 'sqldf', argIdx: 0, argName: 'x' },
					{ package: PkgName.Dplyr, name: 'sql' },
					{ package: 'dbplyr',      name: 'sql' }
				],
				[UnescapedArgumentCategory.Html]: [
					{ package: PkgName.Shiny,   name: 'HTML',          argIdx: 0, argName: 'text' },
					{ package: 'htmltools',     name: 'HTML',          argIdx: 0, argName: 'text' },
					{ package: PkgName.Shiny,   name: 'insertUI',      argIdx: 2, argName: 'ui' },
					{ package: 'htmlwidgets',   name: 'JS' },
					{ package: PkgName.ShinyJs, name: 'runjs',         argIdx: 0, argName: 'code' },
					{ package: PkgName.ShinyJs, name: 'html',          argIdx: 1, argName: 'html' },
					{ package: PkgName.ShinyJs, name: 'extendShinyjs', argIdx: 1, argName: 'text' }
				]
			},
			sanitizers: {
				[UnescapedArgumentCategory.System]: [Identifier.from(['shQuote', PkgName.Base])],
				[UnescapedArgumentCategory.Eval]:   [
					Identifier.from(['match.arg', PkgName.Base]),
					Identifier.from(['make.names', PkgName.Base]),
					Identifier.from(['arg_match', PkgName.Rlang])
				],
				[UnescapedArgumentCategory.Database]: [
					'dbQuoteLiteral', 'dbQuoteString', 'dbQuoteIdentifier', 'sqlInterpolate',
					Identifier.from(['glue_sql', PkgName.Glue]),
					Identifier.from(['glue_data_sql', PkgName.Glue])
				],
				[UnescapedArgumentCategory.Html]: [
					Identifier.from(['htmlEscape', 'htmltools']),
					Identifier.from(['html_escape', 'xfun']),
					Identifier.from(['toJSON', 'jsonlite']),
					Identifier.from(['URLencode', PkgName.Utils])
				]
			},
			quickFixes: {
				[UnescapedArgumentCategory.System]:   { call: 'shQuote' },
				[UnescapedArgumentCategory.Database]: { call: Identifier.from(['dbQuoteLiteral', PkgName.Dbi]), firstArg: { argIdx: 0, argName: 'conn' }, partsOnly: true },
				[UnescapedArgumentCategory.Html]:     { call: Identifier.from(['htmlEscape', 'htmltools']) }
			},
			acceptedInputs: AcceptedInputs
		}
	}
} as const satisfies LintingRule<UnescapedArgumentsResult, UnescapedArgumentsMetadata, UnescapedArgumentsConfig>;
