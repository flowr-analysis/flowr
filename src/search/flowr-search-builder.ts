import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	FlowrSearchElement,
	FlowrSearchElements,
	FlowrSearchGetFilters,
	FlowrSearchInput
} from './flowr-search';
import type { Pipeline } from '../core/steps/pipeline/pipeline';
import type { FlowrFilterExpression } from './flowr-search-filters';
import type { NoInfo } from '../r-bridge/lang-4.x/ast/model/model';
import type { FlowrSearchGeneratorNode } from './search-executor/search-generators';
import type {
	FlowrSearchTransformerNode,
	GetOutputOfTransformer, GetTransformer, TransformerNames
} from './search-executor/search-transformer';


export type FlowrGenerator<P extends Pipeline> = Record<string, (input: FlowrSearchInput<P>) => FlowrSearchElements>

export const FlowrSearchGenerator = {
	all(): FlowrSearchBuilder<[], NoInfo> {
		return new FlowrSearchBuilder({ type: 'generator', name: 'all', args: undefined });
	},
	/**
	 * TODO TODO TODO
	 */
	get(filter: FlowrSearchGetFilters): FlowrSearchBuilder<[], NoInfo> {
		return new FlowrSearchBuilder({ type: 'generator', name: 'get', args: filter });
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

export type FlowrSearchBuilderType<Transformers extends FlowrSearchTransformerNode[] = FlowrSearchTransformerNode[], Info = NoInfo, ElementType = FlowrSearchElements<Info, FlowrSearchElement<Info>[]>> = FlowrSearchBuilder<Transformers, Info, ElementType>;

/**
 * The search query is a combination of a generator and a list of transformers
 * and allows this view to pass such queries in a serialized form.
 */
export interface FlowrSearch<Transformers extends readonly TransformerNames[] = readonly TransformerNames[]> {
	readonly generator: FlowrSearchGeneratorNode;
	readonly search:    readonly FlowrSearchTransformerNode[];
}


type FlowrSearchBuilderOut<Transformers extends FlowrSearchTransformerNode[], Info, Transformer extends TransformerNames> = FlowrSearchBuilder<[...Transformers, Transformer], Info, GetOutputOfTransformer<Transformer['name']>>;

export type FlowrSearchBuilderTransformerNames<Builder> = Builder extends FlowrSearchBuilder<infer Transformers, infer _, infer _> ? Transformers[number]['name'] : never;

/**
 * Allows you to construct a search query from a {@link FlowrSearchGeneratorNode}.
 * In the end, you _can_ freeze the search by calling {@link FlowrSearchBuilder#build},
 * however, the search executors may do that for you.
 *
 * @see {@link FlowrSearchGenerator}
 * @see {@link FlowrSearch}
 * @see {@link FlowrSearchLike}
 */
class FlowrSearchBuilder<Transformers extends FlowrSearchTransformerNode[] = [], Info = NoInfo, ElementType = FlowrSearchElements<Info, FlowrSearchElement<Info>[]>> {
	private readonly generator: FlowrSearchGeneratorNode;
	private readonly search:    Transformers = [] as unknown as Transformers;

	constructor(generator: FlowrSearchGeneratorNode) {
		this.generator = generator;
	}

	/**
	 * TODO
	 *
	 * As filter does not change the type of any contained elements, we can return the same type for type safety checks.
	 */
	filter<Expression extends FlowrFilterExpression>(filter: Expression): FlowrSearchBuilderOut<Transformers, Info, GetTransformer<'filter'> & { args: { filter: Expression }}> {
		this.search.push({ type: 'transformer', name: 'filter', args: { filter: filter } });
		return this as unknown as FlowrSearchBuilderOut<Transformers, Info, GetTransformer<'filter'> & { args: { filter: Expression }}>;
	}

	/**
	 * first either returns the first element of the search or nothing, if no elements are present.
	 */
	first(): FlowrSearchBuilderOut<Transformers,Info, GetTransformer<'first'>> {
		this.search.push({ type: 'transformer', name: 'first', args: undefined });
		return this as unknown as FlowrSearchBuilderOut<Transformers,Info, GetTransformer<'first'>>;
	}

	/**
	 * last either returns the last element of the search or nothing, if no elements are present.
	 */
	last(): FlowrSearchBuilderOut<Transformers,Info, GetTransformer<'last'>> {
		this.search.push({ type: 'transformer', name: 'last', args: undefined });
		return this as unknown as FlowrSearchBuilderOut<Transformers,Info, GetTransformer<'last'>>;
	}
	/**
	 * index returns the element at the given index if it exists
	 */
	index<Idx extends number>(index: Idx): FlowrSearchBuilderOut<Transformers,Info, GetTransformer<'index'> & { args: { index: Idx }}> {
		this.search.push({ type: 'transformer', name: 'index', args: { index } });
		return this as unknown as FlowrSearchBuilderOut<Transformers,Info, GetTransformer<'index'> & { args: { index: Idx }}>;
	}

	/**
	 * tail returns all elements of the search except the first one.
	 */
	tail(): FlowrSearchBuilderOut<Transformers,Info, GetTransformer<'tail'>> {
		this.search.push({ type: 'transformer', name: 'tail', args: undefined });
		return this as unknown as FlowrSearchBuilderOut<Transformers,Info, GetTransformer<'tail'>>;
	}

	/**
	 * take returns the first `count` elements of the search.
	 */
	take<Count extends number>(count: Count): FlowrSearchBuilderOut<Transformers, Info, GetTransformer<'take'> & { args: { count: Count }}> {
		this.search.push({ type: 'transformer', name: 'take', args: { count } });
		return this as unknown as FlowrSearchBuilderOut<Transformers, Info, GetTransformer<'take'> & { args: { count: Count }}>;
	}

	/**
	 * skip returns all elements of the search except the first `count` ones.
	 */
	skip<Count extends number>(count: Count): FlowrSearchBuilderOut<Transformers, Info, GetTransformer<'skip'> & { args: { count: Count }}> {
		this.search.push({ type: 'transformer', name: 'skip', args: { count } });
		return this as unknown as FlowrSearchBuilderOut<Transformers, Info, GetTransformer<'skip'> & { args: { count: Count }}>;
	}

	build(): FlowrSearch<Transformers> {
		return {
			generator: this.generator,
			search:    this.search
		};
	}
}

/**
 * This type summarizes all types that can be used in places in which the API expects you to provide a search query.
 * @see {@link FlowrSearch}
 */
export type FlowrSearchLike = FlowrSearch | FlowrSearchBuilderType;

/**
 * Freezes any accepted {@link FlowrSearchLike} into a {@link FlowrSearch}.
 */
export function getFlowrSearch(search: FlowrSearchLike): FlowrSearch {
	if(search instanceof FlowrSearchBuilder) {
		return search.build();
	}
	return search;
}

