import type { FlowrSearchElement, FlowrSearchInput } from '../flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { EnrichedFlowrSearchElement, Enrichment } from './search-enrichers';
import { Enrichments } from './search-enrichers';
import type { MergeableRecord } from '../../util/objects';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';

export enum Mapper {
    Enrichment = 'enrichment'
}

export interface MapperData<Arguments extends string | MergeableRecord> {
	mapper: (e: FlowrSearchElement<ParentInformation>, data: FlowrSearchInput<Pipeline>, args: Arguments) => FlowrSearchElement<ParentInformation> | undefined
}
export type MapperArguments<M extends Mapper> = typeof Mappers[M] extends MapperData<infer Arguments> ? Arguments : never;

const Mappers = {
	[Mapper.Enrichment]: {
		mapper: (e: FlowrSearchElement<ParentInformation>, _data: FlowrSearchInput<Pipeline>, enrichment: Enrichment) => {
			const data = (e as EnrichedFlowrSearchElement<ParentInformation>)?.enrichments?.[enrichment];
			return data !== undefined ? Enrichments[enrichment].mapper(data) : undefined;
		}
	} satisfies MapperData<Enrichment>
} as const;

export function map<Element extends FlowrSearchElement<ParentInformation>, MapperType extends Mapper>(
	e: Element, data: FlowrSearchInput<Pipeline>, mapper: MapperType, args: MapperArguments<MapperType>): Element | undefined {
	// apparently the type system sucks right now so you have to cast both the mapper and the args to a specific type even though they're made to be compatible
	return Mappers[mapper as Mapper.Enrichment].mapper(e, data, args as MapperArguments<Mapper.Enrichment>) as Element | undefined;
}
