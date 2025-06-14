import type { FlowrSearchLike } from '../search/flowr-search-builder';
import type { FlowrSearchElement, FlowrSearchElements } from '../search/flowr-search';
import type { MergeableRecord } from '../util/objects';
import type { GeneratorNames } from '../search/search-executor/search-generators';
import type { TransformerNames } from '../search/search-executor/search-transformer';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { LintingRuleConfig, LintingRuleMetadata, LintingRuleNames, LintingRuleResult } from './linter-rules';
import type { DataflowInformation } from '../dataflow/info';
import type { DeepPartial, DeepReadonly } from 'ts-essentials';
import type { UniqueArray } from '../util/collections/arrays';
import type { LintingRuleTag } from './linter-tags';


export class LintingRuleInformation<Config extends MergeableRecord = never> {
	private readonly defaultConfig: NoInfer<DeepReadonly<Config>>;
	private readonly tags:          UniqueArray<LintingRuleTag>;
	private readonly description:   string;

	constructor(
		config: NoInfer<DeepReadonly<Config>>,
		tags: UniqueArray<LintingRuleTag>,
		description: string
	) {
		this.defaultConfig = config;
		this.tags = tags;
		this.description = description;
	}

	/**
	 * The default config for this linting rule.
	 * This config is combined with the user config when executing the rule.
	 */
	public getDefaultConfig(): NoInfer<DeepReadonly<Config>> {
		return this.defaultConfig;
	}

	/**
	 * A short list of tags that describe and categorize the linting rule.
	 */
	public getTags(): UniqueArray<LintingRuleTag> {
		return this.tags;
	}

	/**
	 * A short description of the linting rule.
	 * This is used to display the rule in the UI and to provide a brief overview of what the rule does.
	 */
	public describe(): string {
		return this.description;
	}
}

/**
 * The base class for a linting rule, which contains all of its relevant settings.
 * The registry of valid linting rules is stored in {@link LintingRules}.
 */
export abstract class LintingRule<
	Result extends LintingResult,
	Metadata extends MergeableRecord,
	Config extends MergeableRecord = never,
	Info = ParentInformation, Elements extends FlowrSearchElement<Info>[] = FlowrSearchElement<Info>[]
> {
	/**
	 * The information attached to this linting rule.
	 */
	public readonly info: LintingRuleInformation<Config>;

	protected constructor(info: LintingRuleInformation<Config>) {
		this.info = info;
	}

	/**
	 * Creates a flowR search that will then be executed and whose results will be passed to {@link processSearchResult}.
	 * In the future, additional optimizations and transformations may be applied to the search between this function and {@link processSearchResult}.
	 */
	public abstract createSearch(config: Config, data: { normalize: NormalizedAst, dataflow: DataflowInformation }): FlowrSearchLike<Info, GeneratorNames, TransformerNames[], FlowrSearchElements<Info, Elements>>;
	/**
	 * Processes the search results of the search created through {@link createSearch}.
	 * This function is expected to return the linting results from this rule for the given search, ie usually the given script file.
	 */
	public abstract processSearchResult(elements: FlowrSearchElements<Info, Elements>, config: Config, data: { normalize: NormalizedAst, dataflow: DataflowInformation }): {
		results: Result[],
		'.meta': Metadata
	};
}

/**
 * A linting result for a single linting rule match.
 */
export abstract class LintingResult {
	public readonly certainty: LintingCertainty;
	/**
	 * A function used to pretty-print the given linting result.
	 * By default, the {@link LintingResult#certainty} is automatically printed alongside this information.
	 */
	public abstract prettyPrint(): string;

	constructor(certainty: LintingCertainty) {
		this.certainty = certainty;
	}
}

export interface ConfiguredLintingRule<Name extends LintingRuleNames = LintingRuleNames> {
	readonly name:   Name
	readonly config: DeepPartial<LintingRuleConfig<Name>>
}

export interface LintingResults<Name extends LintingRuleNames> {
	results: LintingRuleResult<Name>[];
	'.meta': LintingRuleMetadata<Name> & { readonly searchTimeMs: number; readonly processTimeMs: number; };
}

export enum LintingCertainty {
	Maybe = 'maybe',
	Definitely = 'definitely'
}
