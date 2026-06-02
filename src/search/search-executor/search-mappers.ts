import type { FlowrSearchElement } from '../flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type Enrichment, type EnrichmentData, type EnrichmentElementContent, enrichmentContent, Enrichments } from './search-enrichers';
import type { MergeableRecord } from '../../util/objects';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import type { AsyncOrSync } from 'ts-essentials';

export enum Mapper {
	Enrichment = 'enrichment'
}

export interface MapperData<Arguments extends string | MergeableRecord> {
	mapper: (e: FlowrSearchElement<ParentInformation>, data: ReadonlyFlowrAnalysisProvider, args: Arguments) => AsyncOrSync<FlowrSearchElement<ParentInformation>[]>
}
export type MapperArguments<M extends Mapper> = typeof Mappers[M] extends MapperData<infer Arguments> ? Arguments : never;

const Mappers = {
	[Mapper.Enrichment]: {
		mapper: async(e: FlowrSearchElement<ParentInformation>, _data: ReadonlyFlowrAnalysisProvider, enrichment: Enrichment) => {
			const enrichmentData = Enrichments[enrichment] as unknown as EnrichmentData<EnrichmentElementContent<Enrichment>>;
			const content = await enrichmentContent(e, enrichment);
			return content !== undefined ? enrichmentData.mapper?.(content) ?? [] : [];
		}
	} satisfies MapperData<Enrichment>
} as const;

/**
 * Maps the given search element using the specified mapper and arguments.
 */
export async function map<Element extends FlowrSearchElement<ParentInformation>, MapperType extends Mapper>(
	e: Element, data: ReadonlyFlowrAnalysisProvider, mapper: MapperType, args: MapperArguments<MapperType>): Promise<Element[]> {
	return (await (Mappers[mapper] as MapperData<MapperArguments<MapperType>>).mapper(e, data, args)) as Element[];
}
