import type { FlowrSearchElement, FlowrSearchInput } from '../flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';
import type { MergeableRecord } from '../../util/objects';
import { VertexType } from '../../dataflow/graph/vertex';
import { edgeIncludesType, EdgeType } from '../../dataflow/graph/edge';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { resolveByName } from '../../dataflow/environments/resolve-by-name';
import type { Identifier } from '../../dataflow/environments/identifier';
import { initializeCleanEnvironments } from '../../dataflow/environments/environment';

export interface EnrichedFlowrSearchElement<Info> extends FlowrSearchElement<Info> {
	enrichments: { [E in Enrichment]?: EnrichmentContent<E> }
}

export interface EnrichmentData<EnrichmentContent extends MergeableRecord> {
	readonly enrich: (e: FlowrSearchElement<ParentInformation>, data: FlowrSearchInput<Pipeline>) => EnrichmentContent
	/**
	 * The mapping function used by the {@link Mapper.Enrichment} mapper.
	 */
	readonly mapper: (c: EnrichmentContent) => FlowrSearchElement<ParentInformation>[]
}
export type EnrichmentContent<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer Content> ? Content : never;

export enum Enrichment {
	CallTargets = 'call-targets',
	Documentation = 'documentation'
}

export interface CallTargetsContent extends MergeableRecord {
	/**
	 * The call targets of the function call.
	 * For identifier call targets, the identifier is the name of the library function being called.
	 */
	targets: (FlowrSearchElement<ParentInformation> | Identifier)[];
}

export const Enrichments = {
	[Enrichment.CallTargets]: {
		enrich: (e: FlowrSearchElement<ParentInformation>, data: FlowrSearchInput<Pipeline>) => {
			// we don't resolve aliases here yet!

			const content: CallTargetsContent = { targets: [] };
			const callVertex = data.dataflow.graph.get(e.node.info.id);
			if(callVertex !== undefined && callVertex[0].tag === VertexType.FunctionCall) {
				const [info, outgoing] = callVertex;

				// find call targets in user code (which have ids!)
				content.targets.push(...[...outgoing]
					.filter(([, e]) => edgeIncludesType(e.types, EdgeType.Calls))
					.map(([t]) => ({ node: data.normalize.idMap.get(t) as RNode<ParentInformation> })));

				// find builtin call targets (which don't have ids, so we just put the name)
				const resolved = resolveByName(info.name, info.environment ?? initializeCleanEnvironments());
				if(resolved) {
					content.targets.push(...resolved.map(r => r.name).filter(i => i !== undefined));
				}
			}
			return content;
		},
		// as built-in call target enrichments are not nodes, we don't return them as part of the mapper!
		mapper: ({ targets }: CallTargetsContent) => targets.map(t => t as FlowrSearchElement<ParentInformation>).filter(t => t.node !== undefined)
	} satisfies EnrichmentData<CallTargetsContent>,
	[Enrichment.Documentation]: {
		enrich: (_e: FlowrSearchElement<ParentInformation>, _data: FlowrSearchInput<Pipeline>): {documentation: FlowrSearchElement<ParentInformation>[]} => {
			// TODO this should do something lmao
			return { documentation: [] };
		},
		mapper: ({ documentation }: {documentation: FlowrSearchElement<ParentInformation>[]}) => documentation
	} satisfies EnrichmentData<{documentation: FlowrSearchElement<ParentInformation>[]}>
} as const;

export function enrichmentContent<E extends Enrichment>(e: FlowrSearchElement<ParentInformation>, enrichment: E): EnrichmentContent<E> {
	return (e as EnrichedFlowrSearchElement<ParentInformation>)?.enrichments?.[enrichment] as EnrichmentContent<E>;
}

export function enrich<
	ElementIn extends FlowrSearchElement<ParentInformation>,
	ElementOut extends ElementIn & EnrichedFlowrSearchElement<ParentInformation>>(
	e: ElementIn, data: FlowrSearchInput<Pipeline>, enrichment: Enrichment): ElementOut {
	return {
		...e,
		enrichments: {
			...(e as ElementIn & EnrichedFlowrSearchElement<ParentInformation>)?.enrichments ?? {},
			[enrichment]: Enrichments[enrichment].enrich(e, data)
		}
	} as ElementOut;
}
