import type {
	FlowrSearchElement,
	FlowrSearchElements,
	FlowrSearchInput, FlowrSearchTransformerNodeBase
} from '../flowr-search';




import type { Pipeline } from '../../core/steps/pipeline/pipeline';
import type { LastOfArray, Tail2TypesOrUndefined, TailOfArray } from '../../util/arrays';
import type { FlowrFilterExpression } from '../flowr-search-filters';
import { evalFilter } from '../flowr-search-filters';
import type { FlowrSearchGeneratorNode } from './search-generators';
import { runSearch } from '../flowr-search-executor';
import type { FlowrSearch } from '../flowr-search-builder';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { isNotUndefined } from '../../util/assert';


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
	filter: getFilter,
	merge:  getMerge,
	select: getSelect
} as const;


export function getTransformer<Name extends TransformerNames>(name: Name): typeof transformers[Name] {
	if(!transformers[name]) {
		throw new Error(`Unknown transformer: ${name}`);
	}
	return transformers[name];
}

/** If we already have no more elements, cascade will not add any but keep the empty elements, otherwise it will now be NewElements */
type CascadeEmpty<Elements extends FlowrSearchElement<ParentInformation>[], NewElements extends FlowrSearchElement<ParentInformation>[]> =
	Elements extends [] ? FlowrSearchElements<ParentInformation, []> : FlowrSearchElements<ParentInformation, NewElements>;

function getFirst<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE
): CascadeEmpty<Elements, [Elements[0]]> {
	return elements.mutate(e => e.slice(0, 1) as Elements) as unknown as CascadeEmpty<Elements, [Elements[0]]>;
}

function getLast<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE): CascadeEmpty<Elements, [LastOfArray<Elements>]> {
	return elements.mutate(e => e.slice(-1) as Elements) as unknown as CascadeEmpty<Elements, [LastOfArray<Elements>]>;
}

function getIndex<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE, { index }: { index: number }): CascadeEmpty<Elements, [Elements[number]]> {
	return elements.mutate(e => e.slice(index, index + 1) as Elements) as unknown as CascadeEmpty<Elements, [Elements[number]]>;
}

function getSelect<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE, { select }: { select: number[] }): CascadeEmpty<Elements, Elements> {
	return elements.mutate(e => select.map(i => e[i]).filter(isNotUndefined) as Elements) as unknown as CascadeEmpty<Elements, Elements>;
}

function getTail<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE): CascadeEmpty<Elements, TailOfArray<Elements>> {
	return elements.mutate(e => e.slice(1) as Elements) as unknown as CascadeEmpty<Elements, TailOfArray<Elements>>;
}

function getTake<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE, { count }: { count: number }): CascadeEmpty<Elements, TailOfArray<Elements>> {
	return elements.mutate(e => e.slice(0, count) as Elements) as unknown as CascadeEmpty<Elements, TailOfArray<Elements>>;
}

function getSkip<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE, { count }: { count: number }): CascadeEmpty<Elements, TailOfArray<Elements>> {
	return elements.mutate(e => e.slice(count) as Elements) as unknown as CascadeEmpty<Elements, TailOfArray<Elements>>;
}

function getFilter<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: FlowrSearchInput<Pipeline>, elements: FSE, { filter }: { filter: FlowrFilterExpression }): CascadeEmpty<Elements, Elements | []> {
	return elements.mutate(
		e => e.filter(({ node }) => evalFilter(filter, { node, normalize: data.normalize, dataflow: data.dataflow })) as Elements
	) as unknown as CascadeEmpty<Elements, Elements | []>;
}

function getMerge<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	/* search has to be unknown because it is a recursive type */
	data: FlowrSearchInput<Pipeline>, elements: FSE, other: { search: unknown[], generator: FlowrSearchGeneratorNode }): FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]> {
	const resultOther = runSearch(other as FlowrSearch<ParentInformation>, data);
	return elements.addAll(resultOther);
}


