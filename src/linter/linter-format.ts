import type { FlowrSearchLike } from '../search/flowr-search-builder';
import type { FlowrSearchElement } from '../search/flowr-search';
import { FlowrSearchElements } from '../search/flowr-search';
import type { MergeableRecord } from '../util/objects';
import { deepMergeObject } from '../util/objects';
import type { GeneratorNames } from '../search/search-executor/search-generators';
import type { TransformerNames } from '../search/search-executor/search-transformer';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { LintingRuleConfig, LintingRuleNames } from './linter-rules';
import type { DataflowInformation } from '../dataflow/info';
import type { DeepPartial, DeepReadonly } from 'ts-essentials';
import type { UniqueArray } from '../util/collections/arrays';
import type { LintingRuleTag } from './linter-tags';
import { guard } from '../util/assert';
import { runSearch } from '../search/flowr-search-executor';


export class LintingRuleInformation<Name extends string = string, Config extends MergeableRecord = never> {
	private readonly name:          Name;
	private readonly defaultConfig: NoInfer<DeepReadonly<Config>>;
	private readonly tags:          UniqueArray<LintingRuleTag>;
	private readonly description:   string;

	constructor(
		name: Name,
		config: NoInfer<DeepReadonly<Config>>,
		tags: UniqueArray<LintingRuleTag>,
		description: string
	) {
		guard(name.trim().length > 0, 'Linting rule name must not be empty');
		guard(config !== undefined, 'Linting rule config must not be undefined');
		this.name = name;
		this.defaultConfig = config;
		this.tags = tags;
		this.description = description;
	}

	/**
	 * The name of the linting rule.
	 * This is used to identify the rule in the UI and in the configuration.
	 * Please try to make it unique and descriptive to avoid confusion with other rules.
	 */
	public getName(): Name {
		return this.name;
	}

	/**
	 * The default config for this linting rule.
	 * This config is combined with the user config when executing the rule.
	 */
	public getDefaultConfig(): DeepReadonly<Config> {
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
	Name extends string,
	Result extends LintingResult,
	Metadata extends MergeableRecord,
	Config extends MergeableRecord = never,
	Info = ParentInformation, Elements extends FlowrSearchElement<Info>[] = FlowrSearchElement<Info>[]
> {
	/**
	 * The information attached to this linting rule.
	 */
	public readonly info: LintingRuleInformation<Name, Config>;

	protected constructor(info: LintingRuleInformation<Name, Config>) {
		this.info = info;
	}

	/**
	 * Executes the linting rule on the given input data.
	 * @param config  - The configuration for this linting rule, which is merged with the default config of the rule.
	 * @param input   - The data to be used for the search, which contains the normalized AST and the dataflow information.
	 */
	public search(config: DeepPartial<Config>, input: { normalize: NormalizedAst, dataflow: DataflowInformation }): LintingResults<Result, Metadata> {
		const fullConfig = deepMergeObject(this.info.getDefaultConfig(), config);

		const ruleSearch = this.createSearch(fullConfig, input);

		const searchStart = Date.now();
		const searchResult =  runSearch(ruleSearch, input);
		const searchTime = Date.now() - searchStart;

		const processStart = Date.now();
		const result = this.processSearchResult(new FlowrSearchElements(searchResult), fullConfig, input);
		const processTime = Date.now() - processStart;

		return {
			...result,
			'.meta': {
				...result['.meta'],
				searchTimeMs:  searchTime,
				processTimeMs: processTime
			}
		};
	}

	/**
	 * Creates a flowR search that will then be executed and whose results will be passed to {@link processSearchResult}.
	 * In the future, additional optimizations and transformations may be applied to the search between this function and {@link processSearchResult}.
	 *
	 * @see LintingRule#search
	 */
	protected abstract createSearch(config: Config, data: { normalize: NormalizedAst, dataflow: DataflowInformation }): FlowrSearchLike<Info, GeneratorNames, TransformerNames[], FlowrSearchElements<Info, Elements>>;
	/**
	 * Processes the search results of the search created through {@link createSearch}.
	 * This function is expected to return the linting results from this rule for the given search, ie usually the given script file.
	 */
	protected abstract processSearchResult(elements: FlowrSearchElements<Info, Elements>, config: Config, data: { normalize: NormalizedAst, dataflow: DataflowInformation }): {
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
	 */
	public abstract printShort(): string;
	/**
	 * Produces a more verbose but human-readable representation of the linting result.
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

export interface LintingResults<Result extends LintingResult, Metadata extends MergeableRecord = never> {
	results: Result[];
	'.meta': Metadata & { readonly searchTimeMs: number; readonly processTimeMs: number; };
}

export enum LintingCertainty {
	Maybe = 'maybe',
	Definitely = 'definitely'
}
