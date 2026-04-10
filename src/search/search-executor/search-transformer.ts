import type { FlowrSearchElement, FlowrSearchElements, FlowrSearchTransformerNodeBase } from '../flowr-search';
import type { LastOfArray, Tail2TypesOrUndefined, TailOfArray } from '../../util/collections/arrays';
import { type FlowrFilterExpression , evalFilter } from '../flowr-search-filters';
import type { FlowrSearchGeneratorNode } from './search-generators';
import { runSearch } from '../flowr-search-executor';
import type { FlowrSearch } from '../flowr-search-builder';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { isNotUndefined } from '../../util/assert';
import { type Enrichment, type EnrichmentElementArguments , enrichElement } from './search-enrichers';
import { type Mapper, type MapperArguments , map } from './search-mappers';
import type { ElementOf } from 'ts-essentials';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';


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
	unique: getUnique,
	select: getSelect,
	with:   getWith,
	map:    getMap
} as const;

/**
 * Gets a search-api transformer function for the given name.
 */
export function getTransformer<Name extends TransformerNames>(name: Name): typeof transformers[Name] {
	if(!transformers[name]) {
		throw new Error(`Unknown transformer: ${name}`);
	}
	return transformers[name];
}

function compareByLocation({ node: a }: FlowrSearchElement<ParentInformation>, { node: b }: FlowrSearchElement<ParentInformation>): number {
	if(a.location && b.location) {
		return a.location[0] - b.location[0] || a.location[1] - b.location[1];
	} else if(a.location) {
		return -1;
	}

	return b.location ? 1 : 0;
}

function getFirstByLocation(elements: FlowrSearchElement<ParentInformation>[]): FlowrSearchElement<ParentInformation> | undefined {
	if(elements.length === 0) {
		return undefined;
	}
	return elements.reduce((acc, cur) => {
		if(acc === undefined) {
			return cur;
		}
		return compareByLocation(acc, cur) < 0 ? acc : cur;
	}, undefined as unknown as FlowrSearchElement<ParentInformation>);
}

/* later we can add something like sort partially to get the first k elements */
function sortFully(elements: FlowrSearchElement<ParentInformation>[]): FlowrSearchElement<ParentInformation>[] {
	return elements.sort(compareByLocation);
}

function getLastByLocation(elements: FlowrSearchElement<ParentInformation>[]): FlowrSearchElement<ParentInformation> | undefined {
	if(elements.length === 0) {
		return undefined;
	}
	return elements.reduce((acc, cur) => {
		if(acc === undefined) {
			return cur;
		}
		return compareByLocation(acc, cur) > 0 ? acc : cur;
	}, undefined as unknown as FlowrSearchElement<ParentInformation>);
}

/** If we already have no more elements, cascade will not add any but keep the empty elements, otherwise it will now be NewElements */
type CascadeEmpty<Elements extends FlowrSearchElement<ParentInformation>[], NewElements extends FlowrSearchElement<ParentInformation>[]> =
	Elements extends [] ? FlowrSearchElements<ParentInformation, []> : FlowrSearchElements<ParentInformation, NewElements>;

function getFirst<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: ReadonlyFlowrAnalysisProvider, elements: FSE
): CascadeEmpty<Elements, [Elements[0]]> {
	return elements.mutate(e => [getFirstByLocation(e)] as Elements) as unknown as CascadeEmpty<Elements, [Elements[0]]>;
}

function getLast<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: ReadonlyFlowrAnalysisProvider, elements: FSE): CascadeEmpty<Elements, [LastOfArray<Elements>]> {
	return elements.mutate(e => [getLastByLocation(e)] as Elements) as unknown as CascadeEmpty<Elements, [LastOfArray<Elements>]>;
}

function getIndex<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: ReadonlyFlowrAnalysisProvider, elements: FSE, { index }: { index: number }): CascadeEmpty<Elements, [Elements[number]]> {
	return elements.mutate(e => [sortFully(e)[index]] as Elements) as unknown as CascadeEmpty<Elements, [Elements[number]]>;
}

function getSelect<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: ReadonlyFlowrAnalysisProvider, elements: FSE, { select }: { select: number[] }): CascadeEmpty<Elements, Elements> {
	return elements.mutate(e => {
		sortFully(e);
		return select.map(i => e[i]).filter(isNotUndefined) as Elements;
	}) as unknown as CascadeEmpty<Elements, Elements>;
}

function getTail<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: ReadonlyFlowrAnalysisProvider, elements: FSE): CascadeEmpty<Elements, TailOfArray<Elements>> {
	return elements.mutate(e => {
		const first = getFirstByLocation(e);
		return e.filter(el => el !== first) as Elements;
	}) as unknown as CascadeEmpty<Elements, TailOfArray<Elements>>;
}

function getTake<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: ReadonlyFlowrAnalysisProvider, elements: FSE, { count }: { count: number }): CascadeEmpty<Elements, TailOfArray<Elements>> {
	return elements.mutate(e => sortFully(e).slice(0, count) as Elements) as unknown as CascadeEmpty<Elements, TailOfArray<Elements>>;
}

function getSkip<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: ReadonlyFlowrAnalysisProvider, elements: FSE, { count }: { count: number }): CascadeEmpty<Elements, TailOfArray<Elements>> {
	return elements.mutate(e => sortFully(e).slice(count) as Elements) as unknown as CascadeEmpty<Elements, TailOfArray<Elements>>;
}

async function getFilter<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: ReadonlyFlowrAnalysisProvider, elements: FSE, { filter }: {
		filter: FlowrFilterExpression
	}): Promise<CascadeEmpty<Elements, Elements | []>> {
	const dataflow = await data.dataflow();
	return elements.mutate(
		e => e.filter(e => evalFilter(filter, { element: e, data: { dataflow } })) as Elements
	) as unknown as CascadeEmpty<Elements, Elements | []>;
}

async function getWith<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	input: ReadonlyFlowrAnalysisProvider, elements: FSE, { info, args }: {
		info:  Enrichment,
		args?: EnrichmentElementArguments<Enrichment>
	}): Promise<FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]>> {

	return (await elements.enrich(input, info, args)).mutate(
		async s => await Promise.all(s.map(e => enrichElement(e, elements, input, info, args))) as Elements
	) as unknown as FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]>;
}

function getMap<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: ReadonlyFlowrAnalysisProvider, elements: FSE, { mapper, args }: { mapper: Mapper, args: MapperArguments<Mapper> }): FlowrSearchElements<ParentInformation, Elements> {
	return elements.mutate(
		elements => elements.flatMap(e => map(e, data, mapper, args)) as Elements
	) as unknown as FlowrSearchElements<ParentInformation, Elements>;
}

async function getMerge<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	/* search has to be unknown because it is a recursive type */
	data: ReadonlyFlowrAnalysisProvider, elements: FSE, other: {
		search:    unknown[],
		generator: FlowrSearchGeneratorNode
	}): Promise<FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]>> {
	const resultOther = await runSearch(other as FlowrSearch, data);
	return elements.addAll([...resultOther.getElements()]);
}

function getUnique<Elements extends FlowrSearchElement<ParentInformation>[], FSE extends FlowrSearchElements<ParentInformation, Elements>>(
	data: ReadonlyFlowrAnalysisProvider, elements: FSE): CascadeEmpty<Elements, Elements> {
	return elements.mutate(e =>
		e.reduce((acc, cur) => {
			if(!acc.some(el => el.node.id === cur.node.id)) {
				acc.push(cur as ElementOf<Elements>);
			}
			return acc;
		}, [] as unknown as Elements)
	) as unknown as CascadeEmpty<Elements, Elements>;
}
