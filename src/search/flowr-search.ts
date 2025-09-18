import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { Pipeline, PipelineOutput, PipelineStepOutputWithName } from '../core/steps/pipeline/pipeline';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowInformation } from '../dataflow/info';
import type { FlowrConfigOptions } from '../config';
import type { Enrichment, EnrichmentSearchArguments, EnrichmentData, EnrichmentElementContent, EnrichmentSearchContent, EnrichmentElementArguments } from './search-executor/search-enrichers';
import { Enrichments } from './search-executor/search-enrichers';
import type { KnownParserType, ParseStepOutput } from '../r-bridge/parser';

/**
 * Yes, for now we do technically not need a wrapper around the RNode, but this allows us to attach caches etc.
 * just for the respective search.
 */
export interface FlowrSearchElement<Info> {
	readonly node:         RNode<Info>;
	readonly enrichments?: { [E in Enrichment]?: EnrichmentElementContent<E> }
}

export interface FlowrSearchNodeBase<Type extends string, Name extends string, Args extends Record<string, unknown> | undefined> {
    readonly type: Type;
    readonly name: Name;
    readonly args: Args;
}

export type FlowrSearchGeneratorNodeBase<Name extends string, Args extends Record<string, unknown> | undefined> =
		FlowrSearchNodeBase<'generator', Name, Args>;
export type FlowrSearchTransformerNodeBase<Name extends string, Args extends Record<string, unknown> | undefined> =
		FlowrSearchNodeBase<'transformer', Name, Args>;

export interface FlowrSearchGetFilter extends Record<string, unknown> {
	/**
	 * The node must be in the given line.
	 */
    readonly line?:     number;
	/**
	 * The node must be in the given column.
	 */
    readonly column?:   number;
	/**
	 * The node must have the given name.
	 * To treat this name as a regular expression, set {@link FlowrSearchGetFilter#nameIsRegex} to true.
	 */
    readonly name?:     string;
	/**
	 * Only useful in combination with `name`. If true, the name is treated as a regular expression.
	 */
	readonly nameIsRegex?: boolean;
	/**
	 * The node must have the given id.
	 */
    readonly id?:       NodeId;
}

type MinimumInputForFlowrSearch<P extends Pipeline> =
    PipelineStepOutputWithName<P, 'parse'> extends ParseStepOutput<KnownParserType> ? (
        PipelineStepOutputWithName<P, 'normalize'> extends NormalizedAst ? (
            PipelineStepOutputWithName<P, 'dataflow'> extends DataflowInformation ? PipelineOutput<P> & { parse: { parsed: KnownParserType }, normalize: NormalizedAst, dataflow: DataflowInformation, config: FlowrConfigOptions }
                : never
        ): never
    ): never

/** we allow any pipeline, which provides us with a 'normalize' and 'dataflow' step */
export type FlowrSearchInput<
    P extends Pipeline
> = MinimumInputForFlowrSearch<P>

/** Intentionally, we abstract away from an array to avoid the use of conventional typescript operations */
export class FlowrSearchElements<Info = NoInfo, Elements extends FlowrSearchElement<Info>[] = FlowrSearchElement<Info>[]> {
	private elements:    Elements = [] as unknown as Elements;
	private enrichments: { [E in Enrichment]?: EnrichmentSearchContent<E> } = {};

	public constructor(elements?: Elements) {
		if(elements) {
			this.elements = elements;
		}
	}

	public add(element: FlowrSearchElement<Info>): this {
		this.elements.push(element);
		return this;
	}

	public addAll(elements: FlowrSearchElement<Info>[]): this {
		this.elements.push(...elements);
		return this;
	}

	public getElements(): Readonly<Elements> {
		return this.elements;
	}

	public mutate<OutElements extends Elements>(mutator: (elements: Elements) => OutElements): this {
		this.elements = mutator(this.elements);
		return this;
	}

	/**
	 * Enriches this flowr search element collection with the given enrichment.
	 * To retrieve enrichment content for a given enrichment type, use {@link enrichmentContent}.
	 *
	 * Please note that this function does not also enrich individual elements, which is done through {@link enrichElement}. Both functions are called in a consise manner in {@link FlowrSearchBuilder.with}, which is the preferred way to add enrichments to a search.
	 */
	public enrich<E extends Enrichment>(data: FlowrSearchInput<Pipeline>, enrichment: E, args?: EnrichmentSearchArguments<E>): this {
		const enrichmentData = Enrichments[enrichment] as unknown as EnrichmentData<EnrichmentElementContent<E>, EnrichmentElementArguments<E>, EnrichmentSearchContent<E>, EnrichmentSearchArguments<E>>;
		if(enrichmentData.enrichSearch !== undefined) {
			this.enrichments = {
				...this.enrichments ?? {},
				[enrichment]: enrichmentData.enrichSearch(this as FlowrSearchElements<ParentInformation>, data, args, this.enrichments?.[enrichment])
			};
		}
		return this;
	}

	public enrichmentContent<E extends Enrichment>(enrichment: E): EnrichmentSearchContent<E> {
		return this.enrichments?.[enrichment] as EnrichmentSearchContent<E>;
	}
}
