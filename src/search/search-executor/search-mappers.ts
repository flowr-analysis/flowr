import type { FlowrSearchElement } from '../flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type Enrichment, type EnrichmentData, type EnrichmentElementContent , enrichmentContent, Enrichments } from './search-enrichers';
import type { MergeableRecord } from '../../util/objects';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';

export enum Mapper {
    Enrichment = 'enrichment'
}

export interface MapperData<Arguments extends string | MergeableRecord> {
	mapper: (e: FlowrSearchElement<ParentInformation>, data: ReadonlyFlowrAnalysisProvider, args: Arguments) => FlowrSearchElement<ParentInformation>[]
}
export type MapperArguments<M extends Mapper> = typeof Mappers[M] extends MapperData<infer Arguments> ? Arguments : never;

const Mappers = {
	[Mapper.Enrichment]: {
		mapper: (e: FlowrSearchElement<ParentInformation>, _data: ReadonlyFlowrAnalysisProvider, enrichment: Enrichment) => {
			const enrichmentData = Enrichments[enrichment] as unknown as EnrichmentData<EnrichmentElementContent<Enrichment>>;
			const content = enrichmentContent(e, enrichment);
			return content !== undefined ? enrichmentData.mapper?.(content) ?? [] : [];
		}
	} satisfies MapperData<Enrichment>
} as const;


/**
 *
 */
export function map<Element extends FlowrSearchElement<ParentInformation>, MapperType extends Mapper>(
	e: Element, data: ReadonlyFlowrAnalysisProvider, mapper: MapperType, args: MapperArguments<MapperType>): Element[] {
	return (Mappers[mapper] as MapperData<MapperArguments<MapperType>>).mapper(e, data, args) as Element[];
}
