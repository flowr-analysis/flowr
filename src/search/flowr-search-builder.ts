import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	FlowrSearchElement,
	FlowrSearchElements,
	FlowrSearchGetFilters
} from './flowr-search';
import type { FlowrFilterExpression } from './flowr-search-filters';
import type { NoInfo } from '../r-bridge/lang-4.x/ast/model/model';
import type { FlowrSearchGeneratorNode, GeneratorNames } from './search-executor/search-generators';
import type {
	FlowrSearchTransformerNode, GetOutputOfTransformer, TransformerNames
} from './search-executor/search-transformer';
import { optimize } from './search-optimizer/search-optimizer';
import type { SlicingCriteria } from '../slicing/criterion/parse';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { guard } from '../util/assert';


type FlowrCriteriaReturn<C extends SlicingCriteria> = FlowrSearchElements<ParentInformation, C extends [] ? never : C extends [infer _] ?
	[FlowrSearchElement<ParentInformation>] : FlowrSearchElement<ParentInformation>[]>;

export const FlowrSearchGenerator = {
	all(): FlowrSearchBuilder<'all'> {
		return new FlowrSearchBuilder({ type: 'generator', name: 'all', args: undefined });
	},
	/**
	 * Returns all elements that match the given {@link FlowrSearchGetFilters|filters}.
	 */
	get(filter: FlowrSearchGetFilters): FlowrSearchBuilder<'get'> {
		return new FlowrSearchBuilder({ type: 'generator', name: 'get', args: filter });
	},
	/**
	 * Returns all elements that match the given {@link SlicingCriteria|criteria}.
	 * This will throw an error, if any criteria cannot be resolved to an id.
	 */
	criterion<Criteria extends SlicingCriteria>(...criterion: Criteria): FlowrSearchBuilder<'criterion', [], ParentInformation, FlowrCriteriaReturn<Criteria>> {
		guard(criterion.length > 0, 'At least one criterion must be provided');
		return new FlowrSearchBuilder({ type: 'generator', name: 'criterion', args: criterion });
	},
	/**
	 * Short form of {@link get} with only the
	 * {@link FlowrSearchGetFilters#line|line} and {@link FlowrSearchGetFilters#column|column} filters:
	 * `get({line, column})`.
	 */
	loc(line?: number, column?: number) {
		return FlowrSearchGenerator.get({ line, column });
	},
	/**
	 * Short form of {@link get} with only the {@link FlowrSearchGetFilters#name|name} filter:
	 * `get({name})`.
	 */
	var(name: string) {
		return FlowrSearchGenerator.get({ name });
	},
	/**
	 * Short form of {@link get} with only the {@link FlowrSearchGetFilters#id|id} filter:
	 * `get({id})`.
	 */
	id(id: NodeId) {
		return FlowrSearchGenerator.get({ id });
	}
} as const;

export type FlowrSearchBuilderType<Generator extends GeneratorNames = GeneratorNames, Transformers extends TransformerNames[] = TransformerNames[], Info = NoInfo, ElementType = FlowrSearchElements<Info, FlowrSearchElement<Info>[]>> = FlowrSearchBuilder<Generator, Transformers, Info, ElementType>;

/**
 * The search query is a combination of a generator and a list of transformers
 * and allows this view to pass such queries in a serialized form.
 *
 * @typeParam Transformers - The list of transformers that are applied to the generator's output.
 */
export interface FlowrSearch<
	// eslint-disable-next-line @typescript-eslint/naming-convention -- type is kept in sync
	_Generator extends GeneratorNames = GeneratorNames,
	// eslint-disable-next-line @typescript-eslint/naming-convention -- type is kept in sync
	_Transformers extends readonly TransformerNames[] = readonly TransformerNames[],
	// eslint-disable-next-line @typescript-eslint/naming-convention -- type is kept in sync
	_ElementType = FlowrSearchElements<NoInfo, FlowrSearchElement<NoInfo>[]>
> {
	readonly generator: FlowrSearchGeneratorNode;
	readonly search:    readonly FlowrSearchTransformerNode[];
}


type FlowrSearchBuilderOut<Generator extends GeneratorNames, Transformers extends TransformerNames[], Info, Transformer extends TransformerNames> = FlowrSearchBuilder<Generator,[...Transformers, Transformer], Info, GetOutputOfTransformer<Transformer>>;

/**
 * Allows you to construct a search query from a {@link FlowrSearchGeneratorNode}.
 * In the end, you _can_ freeze the search by calling {@link FlowrSearchBuilder#build},
 * however, the search executors may do that for you.
 *
 * @see {@link FlowrSearchGenerator}
 * @see {@link FlowrSearch}
 * @see {@link FlowrSearchLike}
 */
class FlowrSearchBuilder<Generator extends GeneratorNames, Transformers extends TransformerNames[] = [], Info = NoInfo, ElementType = FlowrSearchElements<Info, FlowrSearchElement<Info>[]>> {
	private readonly generator: FlowrSearchGeneratorNode;
	private readonly search:    FlowrSearchTransformerNode[] = [];

	constructor(generator: FlowrSearchGeneratorNode) {
		this.generator = generator;
	}

	/**
	 * TODO
	 *
	 * As filter does not change the type of any contained elements, we can return the same type for type safety checks.
	 */
	filter(filter: FlowrFilterExpression): FlowrSearchBuilderOut<Generator, Transformers, Info, 'filter'> {
		this.search.push({ type: 'transformer', name: 'filter', args: { filter: filter } });
		return this;
	}

	/**
	 * first either returns the first element of the search or nothing, if no elements are present.
	 */
	first(): FlowrSearchBuilderOut<Generator, Transformers,Info, 'first'> {
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
		this.search.push({ type: 'transformer', name: 'take', args: { count } });
		return this;
	}

	/**
	 * skip returns all elements of the search except the first `count` ones.
	 */
	skip<Count extends number>(count: Count): FlowrSearchBuilderOut<Generator, Transformers, Info, 'skip'> {
		this.search.push({ type: 'transformer', name: 'skip', args: { count } });
		return this;
	}

	build(): FlowrSearch<Generator, Transformers, ElementType> {
		return optimize(this.generator, this.search);
	}
}

/**
 * This type summarizes all types that can be used in places in which the API expects you to provide a search query.
 * @see {@link FlowrSearch}
 */
export type FlowrSearchLike = FlowrSearch | FlowrSearchBuilderType;

export type SearchOutput<Search> = Search extends FlowrSearch ? Search : Search extends FlowrSearchBuilderType<infer Generator, infer Transformers, infer _, infer Elements> ? FlowrSearch<Generator, Transformers, Elements> : never;

/**
 * Freezes any accepted {@link FlowrSearchLike} into a {@link FlowrSearch}.
 */
export function getFlowrSearch<Search extends FlowrSearchLike>(search: Search): SearchOutput<Search> {
	if(search instanceof FlowrSearchBuilder) {
		return search.build() as SearchOutput<Search>;
	}
	return search as SearchOutput<Search>;
}

