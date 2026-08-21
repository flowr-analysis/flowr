import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';
import type { ArgProps, CallProps } from '../../dataflow/environments/built-in-props';
import { ArgProp, CallProp, FnSig } from '../../dataflow/environments/built-in-props';
import { Identifier, PkgName } from '../../dataflow/environments/identifier';
import { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { FunctionCallVertex } from '../../dataflow/graph/vertex';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { CallTargets } from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { narrowingFunctions } from '../../queries/catalog/input-sources-query/input-source-functions';
import type { InputSource, InputSources } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { InputTraceType, InputType } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FlowrSearchElement } from '../../search/flowr-search';
import { Q } from '../../search/flowr-search-builder';
import { SlicingCriterion } from '../../slicing/criterion/parse';
import { matchArgumentsToParameters } from '../../util/arg-matching';
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
	/** The role of the argument of the critical call to use as first argument for the escape function */
	readonly firstArg?:  ArgProps;
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
	 * The call properties of critical function calls for a category that perform a critical operation
	 * @see {@link CallProps}
	 */
	readonly criticalCalls:      Readonly<Record<UnescapedArgumentCategory, CallProps>>;
	/**
	 * The argument properties of critical arguments of critical functions
	 * @see {@link ArgProps}
	 */
	readonly criticalArgs:       ArgProps;
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
	readonly category:  UnescapedArgumentCategory;
	/** The function performing the critical operation */
	readonly name:      Identifier;
	/** The function signature of the critical function containing the parameters */
	readonly signature: FnSig;
}

/** An argument of a critical function call */
interface CriticalTarget {
	readonly category:  UnescapedArgumentCategory;
	readonly call:      DataflowGraphVertexFunctionCall;
	readonly signature: FnSig;
	readonly arg:       NodeId;
	readonly location:  SourceLocation;
}

interface CriticalTargetEntry {
	readonly target: CriticalTarget;
	readonly call:   NodeId;
	readonly only:   ReadonlySet<NodeId> | undefined;
	readonly depth:  number;
}

/** Find all arguments of a function call that have a given argument property using the function signature */
function findArgumentsWithProps(call: DataflowGraphVertexFunctionCall, signature: FnSig, props: ArgProps): NodeId[] {
	const layout = FnSig.layout(signature);
	const bound = matchArgumentsToParameters(call.args.map(FunctionArgument.getName), signature.map(([param]) => param));

	return call.args
		.filter((_, index) => bound[index] !== undefined && (FnSig.propAt(layout, bound[index]) & props) !== 0)
		.map(FunctionArgument.getReference).filter(isNotUndefined);
}

/** Get the critical calls of every category that is not disabled */
function getEnabledCriticalCalls(config: UnescapedArgumentsConfig, index: BuiltInIndex = BuiltInIndex.default()): CriticalCallEntry[] {
	const result: CriticalCallEntry[] = [];

	for(const category of UnescapedArgumentCategories) {
		const criticalProps = config.criticalCalls[category] ?? 0;

		if(criticalProps === 0 || config.disabledCategories.includes(category)) {
			continue;
		}
		for(const { name, props = 0, sig: signature } of index.entries) {
			if((props & criticalProps) !== 0 && signature?.some(([, prop]) => (prop & config.criticalArgs) !== 0)) {
				result.push({ category, name, signature });
			}
		}
	}
	return result;
}

/** Index the critical calls of the enabled categories by function name */
function indexCriticalCalls(config: UnescapedArgumentsConfig): Map<string, CriticalCallEntry[]> {
	const index = new Map<string, CriticalCallEntry[]>();

	for(const call of getEnabledCriticalCalls(config)) {
		const name = Identifier.getName(call.name);
		const known = index.get(name);

		if(known !== undefined) {
			known.push(call);
		} else {
			index.set(name, [call]);
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
		const call = graph.getVertex(node.info.id);

		if(!FunctionCallVertex.is(call)) {
			continue;
		}
		for(const { category, name, signature } of criticalCalls.get(Identifier.getName(call.name)) ?? []) {
			if(!Identifier.matches(name, call.name) && !Identifier.matches(call.name, name)) {
				continue;
			}
			for(const arg of findArgumentsWithProps(call, signature, config.criticalArgs)) {
				const location = SourceLocation.fromNode(graph.idMap?.get(arg));
				const key = `${category}-${call.id}-${arg}`;

				if(location !== undefined && !seen.has(key)) {
					seen.add(key);
					targets.push({ category, call: call, signature, arg, location });
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
		const [arg] = findArgumentsWithProps(target.call, target.signature, fix.firstArg);
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
		callName:    [...new Set(getEnabledCriticalCalls(config).map(({ name }) => Identifier.getName(name)))],
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
				[UnescapedArgumentCategory.System]:   CallProp.Process,
				[UnescapedArgumentCategory.Eval]:     CallProp.Eval,
				[UnescapedArgumentCategory.Database]: CallProp.Database,
				[UnescapedArgumentCategory.Html]:     CallProp.Html
			},
			criticalArgs: ArgProp.Injectable,
			sanitizers:   {
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
					Identifier.from(['htmlEscape', PkgName.HtmlTools]),
					Identifier.from(['html_escape', 'xfun']),
					Identifier.from(['toJSON', 'jsonlite']),
					Identifier.from(['URLencode', PkgName.Utils])
				]
			},
			quickFixes: {
				[UnescapedArgumentCategory.System]:   { call: 'shQuote' },
				[UnescapedArgumentCategory.Database]: { call: Identifier.from(['dbQuoteLiteral', PkgName.Dbi]), firstArg: ArgProp.Handle, partsOnly: true },
				[UnescapedArgumentCategory.Html]:     { call: Identifier.from(['htmlEscape', PkgName.HtmlTools]) }
			},
			acceptedInputs: AcceptedInputs
		}
	}
} as const satisfies LintingRule<UnescapedArgumentsResult, UnescapedArgumentsMetadata, UnescapedArgumentsConfig>;
