import type { FlowrSearchElement, FlowrSearchInput } from '../flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Enrichment, EnrichmentData, EnrichmentElementContent } from './search-enrichers';
import { enrichmentContent , Enrichments } from './search-enrichers';

import type { MergeableRecord } from '../../util/objects';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';

export enum Mapper {
    Enrichment = 'enrichment'
}

export interface MapperData<Arguments extends string | MergeableRecord> {
	mapper: (e: FlowrSearchElement<ParentInformation>, data: FlowrSearchInput<Pipeline>, args: Arguments) => FlowrSearchElement<ParentInformation>[]
}
export type MapperArguments<M extends Mapper> = typeof Mappers[M] extends MapperData<infer Arguments> ? Arguments : never;

const Mappers = {
	[Mapper.Enrichment]: {
		mapper: (e: FlowrSearchElement<ParentInformation>, _data: FlowrSearchInput<Pipeline>, enrichment: Enrichment) => {
			const enrichmentData = Enrichments[enrichment] as unknown as EnrichmentData<EnrichmentElementContent<Enrichment>>;
			const content = enrichmentContent(e, enrichment);
			return content !== undefined ? enrichmentData.mapper?.(content) ?? [] : [];
		}
	} satisfies MapperData<Enrichment>
} as const;

export function map<Element extends FlowrSearchElement<ParentInformation>, MapperType extends Mapper>(
	e: Element, data: FlowrSearchInput<Pipeline>, mapper: MapperType, args: MapperArguments<MapperType>): Element[] {
	return (Mappers[mapper] as MapperData<MapperArguments<MapperType>>).mapper(e, data, args) as Element[];
}
