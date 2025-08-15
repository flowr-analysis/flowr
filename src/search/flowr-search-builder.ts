import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FlowrSearchElement, FlowrSearchElements, FlowrSearchGetFilter } from './flowr-search';
import type { FlowrFilter, FlowrFilterExpression } from './flowr-search-filters';
import type { FlowrSearchGeneratorNode, GeneratorNames } from './search-executor/search-generators';
import type {
	FlowrSearchTransformerNode,
	GetOutputOfTransformer,
	TransformerNames
} from './search-executor/search-transformer';
import { optimize } from './search-optimizer/search-optimizer';
import type { SlicingCriteria } from '../slicing/criterion/parse';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { guard } from '../util/assert';
import type { Enrichment, EnrichmentElementArguments } from './search-executor/search-enrichers';
import type { MapperArguments } from './search-executor/search-mappers';
import { Mapper } from './search-executor/search-mappers';
import type { Query } from '../queries/query';


type FlowrCriteriaReturn<C extends SlicingCriteria> = FlowrSearchElements<ParentInformation, C extends [] ? never : C extends [infer _] ?
	[FlowrSearchElement<ParentInformation>] : FlowrSearchElement<ParentInformation>[]>;

/**
 * This object holds all the methods to generate search queries.
 * For compatibility, please use the {@link Q} identifier object to access these methods.
 */
export const FlowrSearchGenerator = {
	/**
	 * Initialize a search query with the given elements.
	 * <b>This is not intended to serialize well</b> wrt. the nodes,
	 * see {@link FlowrSearchGenerator.criterion} for a serializable alternative (passing the ids with `$id`).
	 */
	from(from: FlowrSearchElement<ParentInformation> | FlowrSearchElement<ParentInformation>[]): FlowrSearchBuilder<'from'> {
		return new FlowrSearchBuilder({ type: 'generator', name: 'from', args: { from } });
	},
	/**
	 * Initializes a new search query based on the results of the given JSON query or queries.
	 * Internally, the {@link SupportedQuery#flattenInvolvedNodes} function is used to flatten the resulting nodes of the query.
	 * Please note that, due to the fact that not every query involves dataflow nodes, the search may not contain any elements at all for certain queries.
	 */
	fromQuery(...from: readonly Query[]): FlowrSearchBuilder<'from-query', [], ParentInformation, FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]>> {
		return new FlowrSearchBuilder({ type: 'generator', name: 'from-query', args: { from } });
	},
	/**
	 * Returns all elements (nodes/dataflow vertices) from the given data.
	 */
	all(): FlowrSearchBuilder<'all'> {
		return new FlowrSearchBuilder({ type: 'generator', name: 'all', args: undefined });
	},
	/**
	 * Returns all elements that match the given {@link FlowrSearchGetFilters|filters}.
	 * You may pass a negative line number to count from the back.
	 * Please note that this is currently only working for single files, it approximates over the nodes, and it is not to be used for "production".
	 */
	get(filter: FlowrSearchGetFilter): FlowrSearchBuilder<'get'> {
		guard(!filter.nameIsRegex || filter.name, 'If nameIsRegex is set, a name should be provided');
		guard(!filter.line || filter.line != 0, 'If line is set, it must be different from 0 as there is no 0 line');
		guard(!filter.column || filter.column > 0, 'If column is set, it must be greater than 0, but was ' + filter.column);
		return new FlowrSearchBuilder({ type: 'generator', name: 'get', args: { filter } });
	},
	/**
	 * Returns all elements that match the given {@link SlicingCriteria|criteria}
	 * (e.g., `criterion('2@x', '3@<-')`,
	 * to retrieve the first use of `x` in the second line and the first `<-` assignment in the third line).
	 * This will throw an error, if any criteria cannot be resolved to an id.
	 */
	criterion<Criteria extends SlicingCriteria>(...criterion: Criteria): FlowrSearchBuilder<'criterion', [], ParentInformation, FlowrCriteriaReturn<Criteria>> {
		guard(criterion.length > 0, 'At least one criterion must be provided');
		return new FlowrSearchBuilder({ type: 'generator', name: 'criterion', args: { criterion } });
	},
	/**
	 * Short form of {@link get} with only the
	 * {@link FlowrSearchGetFilters#line|line} and {@link FlowrSearchGetFilters#column|column} filters:
	 * `get({line, column})`.
	 */
	loc(line?: number, column?: number): FlowrSearchBuilder<'get'> {
		return FlowrSearchGenerator.get({ line, column });
	},
	/**
	 * Short form of {@link get} with only the {@link FlowrSearchGetFilters#name|name} and {@link FlowrSearchGetFilters#line|line} filters:
	 * `get({name, line})`.
	 */
	varInLine(name: string, line: number): FlowrSearchBuilder<'get'> {
		return FlowrSearchGenerator.get({ name, line });
	},
	/**
	 * Short form of {@link get} with only the {@link FlowrSearchGetFilters#name|name} filter:
	 * `get({name})`.
	 */
	var(name: string): FlowrSearchBuilder<'get'> {
		return FlowrSearchGenerator.get({ name });
	},
	/**
	 * Short form of {@link get} with only the {@link FlowrSearchGetFilters#id|id} filter:
	 * `get({id})`.
	 */
	id(id: NodeId): FlowrSearchBuilder<'get'> {
		return FlowrSearchGenerator.get({ id });
	}
} as const;

/**
 * This is the root object to use for creating searches.
 * See the {@link FlowrSearchGenerator} for the available methods.
 * After the query is generated,
 * you can use what is provided by the {@link FlowrSearchBuilder} to further refine the search.
 */
export const Q = FlowrSearchGenerator;

export type FlowrSearchBuilderType<Generator extends GeneratorNames = GeneratorNames, Transformers extends TransformerNames[] = TransformerNames[], Info = ParentInformation, ElementType = FlowrSearchElements<Info, FlowrSearchElement<Info>[]>> = FlowrSearchBuilder<Generator, Transformers, Info, ElementType>;

/**
 * The search query is a combination of a generator and a list of transformers
 * and allows this view to pass such queries in a serialized form.
 *
 * @typeParam Transformers - The list of transformers that are applied to the generator's output.
 */
export interface FlowrSearch<
	Info = ParentInformation,
	// eslint-disable-next-line @typescript-eslint/naming-convention -- type is kept in sync
	_Generator extends GeneratorNames = GeneratorNames,
	// eslint-disable-next-line @typescript-eslint/naming-convention -- type is kept in sync
	_Transformers extends readonly TransformerNames[] = readonly TransformerNames[],
	// eslint-disable-next-line @typescript-eslint/naming-convention -- type is kept in sync
	_ElementType = FlowrSearchElements<Info, FlowrSearchElement<Info>[]>
> {
	readonly generator: FlowrSearchGeneratorNode;
	readonly search:    readonly FlowrSearchTransformerNode[];
}


type FlowrSearchBuilderOut<Generator extends GeneratorNames, Transformers extends TransformerNames[], Info, Transformer extends TransformerNames> = FlowrSearchBuilder<Generator,[...Transformers, Transformer], Info, GetOutputOfTransformer<Transformer>>;

/**
 * Allows you to construct a search query from a {@link FlowrSearchGeneratorNode}.
 * Please use the {@link Q} object to create an object of this class!
 * In the end, you _can_ freeze the search by calling {@link FlowrSearchBuilder#build},
 * however, the search executors may do that for you.
 *
 * @see {@link FlowrSearchGenerator}
 * @see {@link FlowrSearch}
 * @see {@link FlowrSearchLike}
 */
export class FlowrSearchBuilder<Generator extends GeneratorNames, Transformers extends TransformerNames[] = [], Info = ParentInformation, ElementType = FlowrSearchElements<Info, FlowrSearchElement<Info>[]>> {
	private readonly generator: FlowrSearchGeneratorNode;
	private readonly search:    FlowrSearchTransformerNode[] = [];

	constructor(generator: FlowrSearchGeneratorNode) {
		this.generator = generator;
	}

	/**
	 * only returns the elements that match the given filter.
	 */
	filter<Filter extends FlowrFilter>(filter: FlowrFilterExpression<Filter> ): FlowrSearchBuilderOut<Generator, Transformers, Info, 'filter'> {
		this.search.push({ type: 'transformer', name: 'filter', args: { filter: filter as FlowrFilterExpression } });
		return this;
	}

	/**
	 * first either returns the first element of the search or nothing, if no elements are present.
	 */
	first(): FlowrSearchBuilderOut<Generator, Transformers, Info, 'first'> {
		this.search.push({ type: 'transformer', name: 'first', args: undefined });
		return this;
	}

	/**
	 * last either returns the last element of the search or nothing, if no elements are present.
	 */
	last(): FlowrSearchBuilderOut<Generator, Transformers,Info, 'last'> {
		this.search.push({ type: 'transformer', name: 'last', args: undefined });
		return this;
	}
	/**
	 * index returns the element at the given index if it exists
	 */
	index<Idx extends number>(index: Idx): FlowrSearchBuilderOut<Generator, Transformers,Info, 'index'> {
		guard(index >= 0, 'Index must be greater or equal to 0, but was ' + index);
		this.search.push({ type: 'transformer', name: 'index', args: { index } });
		return this;
	}

	/**
	 * tail returns all elements of the search except the first one.
	 */
	tail(): FlowrSearchBuilderOut<Generator, Transformers,Info, 'tail'> {
		this.search.push({ type: 'transformer', name: 'tail', args: undefined });
		return this;
	}

	/**
	 * take returns the first `count` elements of the search.
	 */
	take<Count extends number>(count: Count): FlowrSearchBuilderOut<Generator, Transformers, Info, 'take'> {
		guard(count >= 0, 'Count must be greater or equal to 0, but was ' + count);
		this.search.push({ type: 'transformer', name: 'take', args: { count } });
		return this;
	}

	/**
	 * skip returns all elements of the search except the first `count` ones.
	 */
	skip<Count extends number>(count: Count): FlowrSearchBuilderOut<Generator, Transformers, Info, 'skip'> {
		guard(count >= 0, 'Count must be greater or equal to 0, but was ' + count);
		this.search.push({ type: 'transformer', name: 'skip', args: { count } });
		return this;
	}

	/**
	 * select returns only the elements at the given indices.
	 */
	select<Select extends number[]>(...select: Select): FlowrSearchBuilderOut<Generator, Transformers, Info, 'select'> {
		guard(select.length > 0, 'At least one index must be provided');
		guard(select.every(i => i >= 0), () => 'All indices must be greater or equal to 0, but were ' + JSON.stringify(select));
		this.search.push({ type: 'transformer', name: 'select', args: { select } });
		return this;
	}

	/**
	 * Adds the given enrichment to each element of the search.
	 * Added enrichments can later be retrieved using the {@link enrichmentContent} function.
	 */
	with<ConcreteEnrichment extends Enrichment>(enrichment: ConcreteEnrichment, args?: EnrichmentElementArguments<ConcreteEnrichment>): FlowrSearchBuilderOut<Generator, Transformers, Info, 'with'> {
		this.search.push( { type: 'transformer', name: 'with', args: { info: enrichment, args: args as EnrichmentElementArguments<Enrichment> } });
		return this;
	}

	/**
	 * Maps the elements of the search to new values using the given mapper function.
	 */
	map<MapperType extends Mapper>(mapper: MapperType, args: MapperArguments<MapperType>): FlowrSearchBuilderOut<Generator, Transformers, Info, 'map'> {
		this.search.push( { type: 'transformer', name: 'map', args: { mapper: mapper, args: args as MapperArguments<Mapper> } });
		return this;
	}

	/**
	 * A convenience function that combines {@link with} and the {@link Mapper.Enrichment} mapper to immediately add an enrichment and then map to its value(s).
	 */
	get<ConcreteEnrichment extends Enrichment>(enrichment: ConcreteEnrichment, args?: EnrichmentElementArguments<ConcreteEnrichment>): FlowrSearchBuilderOut<Generator, Transformers, Info, 'with' | 'map'> {
		return this.with(enrichment, args).map(Mapper.Enrichment, enrichment);
	}

	/**
	 * merge combines the search results with those of another search.
	 */
	merge<Generator2 extends GeneratorNames, Transformers2 extends TransformerNames[], OtherElementType extends FlowrSearchElements<Info, FlowrSearchElement<Info>[]>>(
		other: FlowrSearchBuilder<Generator2, Transformers2, Info, OtherElementType> /* | FlowrSearch<Info, Generator2, Transformers2, OtherElementType> */
	): FlowrSearchBuilder<Generator, Transformers, Info> {
		this.search.push({ type: 'transformer', name: 'merge', args: { generator: other.generator, search: other.search  } });
		return this as unknown as FlowrSearchBuilder<Generator, Transformers, Info>;
	}

	/**
	 * Removes duplicate elements based on the ids of the elements.
	 */
	unique(): FlowrSearchBuilderOut<Generator, Transformers, Info, 'unique'> {
		this.search.push({ type: 'transformer', name: 'unique', args: undefined });
		return this;
	}

	/**
	 * Construct the final search (this may happen automatically with most search handlers).
	 *
	 * @param shouldOptimize - This may optimize the search.
	 */
	build(shouldOptimize = true): FlowrSearch<Info, Generator, Transformers, ElementType> {
		return shouldOptimize ? optimize(this.generator, this.search) : {
			generator: this.generator,
			search:    this.search
		};
	}
}

/**
 * This type summarizes all types that can be used in places in which the API expects you to provide a search query.
 * @see {@link FlowrSearch}
 */
export type FlowrSearchLike<Info = ParentInformation,
	Generator extends GeneratorNames = GeneratorNames,
	Transformers extends TransformerNames[] = TransformerNames[],
	ElementType = FlowrSearchElements<Info, FlowrSearchElement<Info>[]>>
		= FlowrSearch<Info, Generator, Transformers, ElementType> | FlowrSearchBuilderType<Generator, Transformers, Info, ElementType>;

export type SearchOutput<Search> = Search extends FlowrSearch ? Search : Search extends FlowrSearchBuilderType<infer Generator, infer Transformers, infer Info, infer Elements> ? FlowrSearch<Info, Generator, Transformers, Elements> : never;

/**
 * Freezes any accepted {@link FlowrSearchLike} into a {@link FlowrSearch}.
 */
export function getFlowrSearch<Search extends FlowrSearchLike>(search: Search, optimizeIfBuild = true): SearchOutput<Search> {
	if(search instanceof FlowrSearchBuilder) {
		return search.build(optimizeIfBuild) as SearchOutput<Search>;
	}
	return search as SearchOutput<Search>;
}
