import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';
import type { ArgProps, FnSig, PropSelector } from '../../dataflow/environments/built-in-props';
import { ArgProp, CallProps, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { Identifier, PkgName } from '../../dataflow/environments/identifier';
import { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument, NoEdges } from '../../dataflow/graph/graph';
import { MatchArgs } from '../../dataflow/graph/match-args';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { FunctionCallVertex } from '../../dataflow/graph/vertex';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { CallTargets } from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { narrowingFunctions } from '../../queries/catalog/input-sources-query/input-source-functions';
import type { InputSource, InputSources } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { InputTraceType, InputType } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FlowrSearchElement } from '../../search/flowr-search';
import { Q } from '../../search/flowr-search-builder';
import { SlicingCriterion } from '../../slicing/criterion/parse';
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
	/** Functions querying databases, e.g. `DBI::dbGetQuery` */
	Database = 'database',
	/** Functions producing raw HTML, e.g. `shiny::HTML` */
	Html = 'html',
	/** Functions generating/running JavaScript code, e.g. `shinyjs::runjs` */
	JavaScript = 'javascript'
}

/** how many vertices {@link readsParameter} may visit before it gives up on finding one */
const ParameterSearchLimit = 256;

/** Maximum depth to descent to find unescaped part of argument */
const MaxDescentDepth = 5;

/** Input types that are considered to be safe */
const AcceptedInputs: readonly InputType[] = [InputType.Constant, InputType.DerivedConstant];

/** Input types that may be critical (uncertain) */
const UncertainInputs: readonly InputType[] = [InputType.Unknown, InputType.Parameter, InputType.Scope];

interface UnescapedArgumentsEntry {
	/**
	 * The call properties of critical functions calls that perform a critical operation
	 * @see {@link PropSelector}
	 */
	readonly criticalCalls: PropSelector;
	/**
	 * The argument properties of critical arguments of critical functions
	 * @see {@link ArgProps}
	 */
	readonly criticalArgs:  ArgProps;
	/**
	 * The functions that escape an unescaped argument of a critical function
	 */
	readonly sanitizers:    readonly Identifier[];
	/**
	 * The function to wrap an unescaped expression in as quick fix
	 * @see {@link EscapeQuickFix}
	 */
	readonly quickFix?:     EscapeQuickFix;
}

const UnescapedArgumentCategories: readonly UnescapedArgumentCategory[] = Record.values(UnescapedArgumentCategory);

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
	readonly category: UnescapedArgumentCategory;
	/** The identifier of the critical function call */
	readonly function: Identifier;
	/** The unescaped input sources reaching the critical function call */
	readonly sources:  InputSources;
	/** The critical input types reaching the argument */
	readonly input:    readonly InputType[];
}

export interface UnescapedArgumentsMetadata extends MergeableRecord {
	/** The number of critical arguments that were checked */
	totalCriticalArguments: number;
	/** The number of critical arguments that are constant or are already properly escaped */
	totalEscapedArguments:  number;
}

export interface UnescapedArgumentsConfig extends MergeableRecord {
	/**
	 * The target, critical functions, critical arguments, sanitizers and quick fixes for each category
	 */
	readonly categories:         Record<UnescapedArgumentCategory, UnescapedArgumentsEntry>;
	/**
	 * The categories that should be disabled and not checked
	 * @see {@link UnescapedArgumentCategory}
	 */
	readonly disabledCategories: readonly UnescapedArgumentCategory[];
	/**
	 * The input types that count as already escaped
	 * @see {@link InputType}
	 */
	readonly acceptedInputs:     readonly InputType[];
	/**
	 * The maximum depth to descent to find unescaped parts of an argument
	 */
	readonly maxDecentDepth:     number;
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

/** Get the critical calls of every category that is not disabled */
function getEnabledCriticalCalls(config: UnescapedArgumentsConfig, index: BuiltInIndex = BuiltInIndex.default()): CriticalCallEntry[] {
	const result: CriticalCallEntry[] = [];

	for(const category of UnescapedArgumentCategories) {
		const criticalCallProps = config.categories[category].criticalCalls;
		const criticalArgProps = config.categories[category].criticalArgs;

		if(config.disabledCategories.includes(category)) {
			continue;
		}
		for(const entry of index.entries) {
			if(CallProps.hasAny(entry, criticalCallProps) && entry.sig?.some(([, prop]) => (prop & criticalArgProps) !== 0)) {
				result.push({ category, name: entry.name, signature: entry.sig });
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
			for(const arg of MatchArgs.findWithProps(call.args, signature, config.categories[category].criticalArgs)) {
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

/**
 * Whether anything `start` reads is a parameter of an enclosing function. What the call sites happen to pass says
 * nothing here: the function escapes its parameter, and it is one call away from being handed anything at all.
 */
function readsParameter(graph: DataflowGraph, start: NodeId, sanitizers: ReadonlySet<string>): boolean {
	const seen = new Set<NodeId>([start]);
	const queue = [start];
	while(queue.length > 0) {
		const id = queue.pop() as NodeId;
		if(graph.idMap?.get(id)?.info.role === RoleInParent.ParameterName) {
			return true;
		}
		const vertex = graph.getVertex(id);
		/* what a sanitizer hands back is escaped, whatever it read to get there */
		if(FunctionCallVertex.is(vertex) && sanitizers.has(Identifier.getName(vertex.name))) {
			continue;
		}
		if(seen.size > ParameterSearchLimit) {
			return false;
		}
		for(const [to, edge] of graph.outgoingEdges(id) ?? NoEdges) {
			/* only what the value is built from, never the calls it is an argument of */
			if(!seen.has(to) && DfEdge.includesType(edge, EdgeType.Reads | EdgeType.DefinedBy | EdgeType.Returns)) {
				seen.add(to);
				queue.push(to);
			}
		}
	}
	return false;
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
	const sanitizerNames = new Set((config.categories[category].sanitizers ?? []).map(call => Identifier.getName(call)));
	const sanitizers = (config.categories[category].sanitizers ?? []).map(call => ({ call }));
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

				/* a call passing a constant today makes the argument constant, but the function still escapes its
				   parameter, and it is one call away from being handed anything */
				const viaParameter = isAcceptedInput(source, config)
					&& source.types.length > 0 && source.types.every(t => t === InputType.Constant || t === InputType.DerivedConstant)
					&& readsParameter(graph, arg, sanitizerNames);
				if((entry.only !== undefined && !entry.only.has(arg)) || (isAcceptedInput(source, config) && !viaParameter)) {
					continue;
				} else if(entry.depth < config.maxDecentDepth && (source.trace === InputTraceType.Known || viaParameter) && FunctionCallVertex.is(vertex) && !FunctionCallVertex.hasOrigin(vertex, BuiltInProcName.Access)) {
					next.push({ target: entry.target, call: arg, only: undefined, depth: entry.depth + 1 });
				} else {
					const types = viaParameter ? [...source.types, InputType.Parameter] : source.types;
					found.set(entry.target, [...(found.get(entry.target) ?? []), { ...source, id: arg, types }]);
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
		const [arg] = MatchArgs.findWithProps(target.call.args, target.signature, fix.firstArg);
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
	const fix = config.categories[target.category].quickFix;
	const quickFix = fix === undefined ? [] : sources.map(source => escapeFix(fix, target, source, idMap)).filter(isNotUndefined);

	return {
		certainty:  sources.some(source => isCertainlyCritical(source, config)) ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain,
		involvedId: [target.call.id, target.arg],
		loc:        target.location,
		category:   target.category,
		function:   Identifier.toString(target.call.name),
		sources,
		input:      [...new Set(sources.flatMap(source => source.types).filter(type => !config.acceptedInputs.includes(type)))],
		...(quickFix.length > 0 ? { quickFix } : {})
	};
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
			`The argument of \`${Identifier.toString(result.function)}\` at ${SourceLocation.format(result.loc)} reaches a ${result.category} call unescaped (input: ${result.input.join(', ')})`
	},
	info: {
		name:          'Unescaped Arguments',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Smell, LintingRuleTag.Shiny, LintingRuleTag.QuickFix],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Detects arguments of critical system, evaluation, database, and HTML/JavaScript calls that are not properly escaped.',
		defaultConfig: {
			categories: {
				[UnescapedArgumentCategory.System]: {
					criticalCalls: SemanticCallTag.Process,
					criticalArgs:  ArgProp.Injectable,
					sanitizers:    [Identifier.from(['shQuote', PkgName.Base])],
					quickFix:      { call: 'shQuote' }
				},
				[UnescapedArgumentCategory.Eval]: {
					criticalCalls: SemanticCallTag.Eval,
					criticalArgs:  ArgProp.Injectable,
					sanitizers:    [
						Identifier.from(['match.arg', PkgName.Base]),
						Identifier.from(['make.names', PkgName.Base]),
						Identifier.from(['arg_match', PkgName.Rlang])
					]
				},
				[UnescapedArgumentCategory.Database]: {
					criticalCalls: SemanticCallTag.Database,
					criticalArgs:  ArgProp.Injectable,
					sanitizers:    [
						Identifier.from(['dbQuoteLiteral', PkgName.Dbi]),
						Identifier.from(['dbQuoteString', PkgName.Dbi]),
						Identifier.from(['dbQuoteIdentifier', PkgName.Dbi]),
						Identifier.from(['sqlInterpolate', PkgName.Dbi]),
						Identifier.from(['glue_sql', PkgName.Glue]),
						Identifier.from(['glue_data_sql', PkgName.Glue])
					],
					quickFix: { call: Identifier.from(['dbQuoteLiteral', PkgName.Dbi]), firstArg: ArgProp.Handle, partsOnly: true }
				},
				[UnescapedArgumentCategory.Html]: {
					criticalCalls: SemanticCallTag.Html,
					criticalArgs:  ArgProp.Injectable,
					sanitizers:    [
						Identifier.from(['htmlEscape', PkgName.HtmlTools]),
						Identifier.from(['html_escape', 'xfun']),
						Identifier.from(['URLencode', PkgName.Utils])
					],
					quickFix: { call: Identifier.from(['htmlEscape', PkgName.HtmlTools]) }
				},
				[UnescapedArgumentCategory.JavaScript]: {
					criticalCalls: SemanticCallTag.JavaScript,
					criticalArgs:  ArgProp.Injectable,
					sanitizers:    [
						Identifier.from(['toJSON', PkgName.Jsonlite]),
						Identifier.from(['serializeJSON', PkgName.Jsonlite]),
						Identifier.from(['toJSON', 'RJSONIO']),
						Identifier.from(['toJSON', 'rjson'])
					],
					quickFix: { call: Identifier.from(['toJSON', PkgName.Jsonlite]), partsOnly: true }
				}
			},
			disabledCategories: [],
			acceptedInputs:     AcceptedInputs,
			maxDecentDepth:     MaxDescentDepth
		}
	}
} as const satisfies LintingRule<UnescapedArgumentsResult, UnescapedArgumentsMetadata, UnescapedArgumentsConfig>;
