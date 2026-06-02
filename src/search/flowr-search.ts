import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	type Enrichment,
	type EnrichmentData,
	type EnrichmentElementArguments,
	type EnrichmentElementContent,
	type EnrichmentSearchArguments,
	type EnrichmentSearchContent
	, Enrichments,
	LazyEnrichmentContent
} from './search-executor/search-enrichers';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';

/**
 * Yes, for now we do technically not need a wrapper around the RNode, but this allows us to attach caches etc.
 * just for the respective search.
 */
export interface FlowrSearchElement<Info> {
	readonly node:         RNode<Info>;
	readonly enrichments?: { [E in Enrichment]?: LazyEnrichmentContent<EnrichmentElementContent<E>> }
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
	readonly line?:          number;
	/**
	 * The node must be in the given column.
	 */
	readonly column?:        number;
	/**
	 * The node must have the given name.
	 * To treat this name as a regular expression, set {@link FlowrSearchGetFilter#nameIsRegex} to true.
	 */
	readonly name?:          string;
	/**
	 * Only useful in combination with `name`. If true, the name is treated as a regular expression.
	 */
	readonly nameIsRegex?:   boolean;
	/**
	 * The node must have the given id.
	 */
	readonly id?:            NodeId;
	/**
	 * The node must stem form a file with the given path matching the regex
	 * Please note that you can address the full path!
	 * @example
	 * ```ts
	 * // matches all files in any 'tests' folder
	 * filePath: '.*\\tests\\.*'
	 * // matches all files named 'myfile.R' in any folder
	 * filePath: '.*\\/myfile\\.R$'
	 * ```
	 */
	readonly filePathRegex?: string;
}

/** Intentionally, we abstract away from an array to avoid the use of conventional typescript operations */
export class FlowrSearchElements<Info = NoInfo, Elements extends FlowrSearchElement<Info>[] = FlowrSearchElement<Info>[]> {
	private elements:    Elements = [] as unknown as Elements;
	private enrichments: { [E in Enrichment]?: LazyEnrichmentContent<EnrichmentSearchContent<E>> } = {};

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

	public mutate<OutElements extends Elements>(mutator: (elements: Elements) => OutElements | Promise<OutElements>): this | Promise<this> {
		const result = mutator(this.elements);
		if(result instanceof Promise) {
			return result.then(resolvedElements => {
				this.elements = resolvedElements;
				return this;
			});
		} else {
			this.elements = result;
			return this;
		}
	}


	/**
	 * Enriches this flowr search element collection with the given enrichment.
	 * To retrieve enrichment content for a given enrichment type, use {@link enrichmentContent}.
	 *
	 * Please note that this function does not also enrich individual elements, which is done through {@link enrichElement}. Both functions are called in a concise manner in {@link FlowrSearchBuilder.with}, which is the preferred way to add enrichments to a search.
	 */
	public enrich<E extends Enrichment>(data: ReadonlyFlowrAnalysisProvider, enrichment: E, args?: EnrichmentSearchArguments<E>): this {
		const enrichmentData = Enrichments[enrichment] as unknown as EnrichmentData<EnrichmentElementContent<E>, EnrichmentElementArguments<E>, EnrichmentSearchContent<E>, EnrichmentSearchArguments<E>>;
		const enricher = enrichmentData.enrichSearch;
		if(enricher !== undefined) {
			const prevEnrichment = this.enrichments?.[enrichment];
			this.enrichments = {
				...this.enrichments ?? {},
				[enrichment]: new LazyEnrichmentContent<EnrichmentSearchContent<E>>(async() =>
					await enricher(this as FlowrSearchElements<ParentInformation>, data, args, prevEnrichment && (() => prevEnrichment.get())))
			};
		}
		return this;
	}

	public async enrichmentContent<E extends Enrichment>(enrichment: E): Promise<EnrichmentSearchContent<E>> {
		return await (this.enrichments?.[enrichment] as LazyEnrichmentContent<EnrichmentSearchContent<E>>)?.get();
	}
}
