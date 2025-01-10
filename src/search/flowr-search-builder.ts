import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	FlowrSearchElement,
	FlowrSearchElements,
	FlowrSearchGeneratorNode, FlowrSearchGetFilters,
	FlowrSearchInput, FlowrSearchTransformerNode
} from './flowr-search';
import type { Pipeline } from '../core/steps/pipeline/pipeline';
import type { FlowrFilterExpression } from './flowr-search-filters';
import type { NoInfo } from '../r-bridge/lang-4.x/ast/model/model';


export type FlowrGenerator<P extends Pipeline> = Record<string, (input: FlowrSearchInput<P>) => FlowrSearchElements>

export const FlowrSearchGenerator = {
	all(): FlowrSearchBuilder<NoInfo> {
		return new FlowrSearchBuilder({ type: 'generator', name: 'all', args: undefined });
	},
	/**
	 * TODO TODO TODO
	 */
	get(filter: FlowrSearchGetFilters): FlowrSearchBuilder<NoInfo> {
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

export type FlowrSearchBuilderType<Info = NoInfo, ElementType = FlowrSearchElements<Info, FlowrSearchElement<Info>[]>> = FlowrSearchBuilder<Info, ElementType>;

/**
 * The search query is a combination of a generator and a list of transformers
 * and allows this view to pass such queries in a serialized form.
 */
export interface FlowrSearch {
	readonly generator: FlowrSearchGeneratorNode;
	readonly search:    readonly FlowrSearchTransformerNode[];
}

/**
 * Allows you to construct a search query from a {@link FlowrSearchGeneratorNode}.
 * In the end, you _can_ freeze the search by calling {@link FlowrSearchBuilder#build},
 * however, the search executors may do that for you.
 *
 * @see {@link FlowrSearchGenerator}
 * @see {@link FlowrSearch}
 * @see {@link FlowrSearchLike}
 */
class FlowrSearchBuilder<Info, ElementType = FlowrSearchElements<Info, FlowrSearchElement<Info>[]>> {
	private generator: FlowrSearchGeneratorNode;
	private search:    FlowrSearchTransformerNode[] = [];

	constructor(generator: FlowrSearchGeneratorNode) {
		this.generator = generator;
	}

	/**
	 * TODO
	 *
	 * As filter does not change the type of any contained elements, we can return the same type for type safety checks.
	 */
	filter(filter: FlowrFilterExpression): this {
		this.search.push({ type: 'transformer', name: 'filter', args: { filter: filter } });
		return this;
	}

	/**
	 * first either returns the first element of the search or nothing, if no elements are present.
	 */
	first(): FlowrSearchBuilder<Info, [FlowrSearchElement<Info>] | []> {
		this.search.push({ type: 'transformer', name: 'first', args: undefined });
		return this as unknown as FlowrSearchBuilder<Info, [FlowrSearchElement<Info>] | []>;
	}

	/**
	 * last either returns the last element of the search or nothing, if no elements are present.
	 */
	last(): FlowrSearchBuilder<Info, [FlowrSearchElement<Info>] | []> {
		this.search.push({ type: 'transformer', name: 'last', args: undefined });
		return this as unknown as FlowrSearchBuilder<Info, [FlowrSearchElement<Info>] | []>;
	}
	/**
	 * index returns the element at the given index if it exists
	 */
	index(index: number): FlowrSearchBuilder<Info, [FlowrSearchElement<Info>] | []> {
		this.search.push({ type: 'transformer', name: 'index', args: { index } });
		return this as unknown as FlowrSearchBuilder<Info, [FlowrSearchElement<Info>] | []>;
	}
	/**
	 * tail returns all elements of the search except the first one.
	 */
	tail(): this {
		this.search.push({ type: 'transformer', name: 'tail', args: undefined });
		return this;
	}

	/**
	 * take returns the first `count` elements of the search.
	 */
	take(count: number): this {
		this.search.push({ type: 'transformer', name: 'take', args: { count } });
		return this;
	}

	/**
	 * skip returns all elements of the search except the first `count` ones.
	 */
	skip(count: number): this {
		this.search.push({ type: 'transformer', name: 'skip', args: { count } });
		return this;
	}

	build(): FlowrSearch {
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

