import type {
	FlowrSearchElement,
	FlowrSearchElements,
	FlowrSearchInput, FlowrSearchTransformerNodeBase
} from '../flowr-search';




import type { Pipeline } from '../../core/steps/pipeline/pipeline';
import type { LastOfArray, Tail2TypesOrUndefined, TailOfArray } from '../../util/arrays';
import type { FlowrFilterExpression } from '../flowr-search-filters';


/**
 * This is a union of all possible transformer node types
 */
export type FlowrSearchTransformerNode = {
    [K in TransformerNames]:
	FlowrSearchTransformerNodeBase<K,
		Tail2TypesOrUndefined<Parameters<typeof transformers[K]>>
    >
}[TransformerNames]

export type TransformerNames = keyof typeof transformers;

export type GetTransformer<Name extends TransformerNames> = FlowrSearchTransformerNode & { name: Name }

export type GetOutputOfTransformer<Name extends TransformerNames> = ReturnType<typeof transformers[Name]>;


/**
 * All supported generators!
 */
export const transformers = {
	first:  getFirst,
	last:   getLast,
	index:  getIndex,
	tail:   getTail,
	take:   getTake,
	skip:   getSkip,
	filter: getFilter
} as const;

/** If we already have no more elements, cascade will not add any but keep the empty elements, otherwise it will now be NewElements */
type CascadeEmpty<Info, Elements extends FlowrSearchElement<Info>[], NewElements extends FlowrSearchElement<Info>[]> =
	Elements extends [] ? FlowrSearchElements<Info, []> : FlowrSearchElements<Info, NewElements>;

function getFirst<Info, Elements extends FlowrSearchElement<Info>[], FSE extends FlowrSearchElements<Info, Elements> = FlowrSearchElements<Info, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE): CascadeEmpty<Info, Elements, [Elements[0]]> {
	return elements.mutate(e => e.slice(0, 1) as Elements) as unknown as CascadeEmpty<Info, Elements, [Elements[0]]>;
}

function getLast<Info, Elements extends FlowrSearchElement<Info>[], FSE extends FlowrSearchElements<Info, Elements> = FlowrSearchElements<Info, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE): CascadeEmpty<Info, Elements, [LastOfArray<Elements>]> {
	return elements.mutate(e => e.slice(-1) as Elements) as unknown as CascadeEmpty<Info, Elements, [LastOfArray<Elements>]>;
}

function getIndex<Info, Elements extends FlowrSearchElement<Info>[], FSE extends FlowrSearchElements<Info, Elements> = FlowrSearchElements<Info, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE, { index }: { index: number }): CascadeEmpty<Info, Elements, [Elements[number]]> {
	return elements.mutate(e => e.slice(index, index + 1) as Elements) as unknown as CascadeEmpty<Info, Elements, [Elements[number]]>;
}

function getTail<Info, Elements extends FlowrSearchElement<Info>[], FSE extends FlowrSearchElements<Info, Elements> = FlowrSearchElements<Info, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE): CascadeEmpty<Info, Elements, TailOfArray<Elements>> {
	return elements.mutate(e => e.slice(1) as Elements) as unknown as CascadeEmpty<Info, Elements, TailOfArray<Elements>>;
}

function getTake<Info, Elements extends FlowrSearchElement<Info>[], FSE extends FlowrSearchElements<Info, Elements> = FlowrSearchElements<Info, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE, { count }: { count: number }): CascadeEmpty<Info, Elements, TailOfArray<Elements>> {
	return elements.mutate(e => e.slice(0, count) as Elements) as unknown as CascadeEmpty<Info, Elements, TailOfArray<Elements>>;
}

function getSkip<Info, Elements extends FlowrSearchElement<Info>[], FSE extends FlowrSearchElements<Info, Elements> = FlowrSearchElements<Info, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE, { count }: { count: number }): CascadeEmpty<Info, Elements, TailOfArray<Elements>> {
	return elements.mutate(e => e.slice(count) as Elements) as unknown as CascadeEmpty<Info, Elements, TailOfArray<Elements>>;
}

function getFilter<Info, Elements extends FlowrSearchElement<Info>[], FSE extends FlowrSearchElements<Info, Elements> = FlowrSearchElements<Info, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE, { filter }: { filter: FlowrFilterExpression }): CascadeEmpty<Info, Elements, Elements | []> {
	// TODO!
	return elements as unknown as CascadeEmpty<Info, Elements, Elements | []>;
}


