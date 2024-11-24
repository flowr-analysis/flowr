import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { Pipeline, PipelineOutput, PipelineStepOutputWithName } from '../core/steps/pipeline/pipeline';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FlowrFilterExpression } from './flowr-search-filters';
import type { DataflowGraph } from '../dataflow/graph/graph';

export interface FlowrSearchElement<Info> {
    readonly node: RNode<Info>;
}

export interface FlowrSearchNodeBase<Type extends string, Name extends string, Args extends Record<string, unknown> | undefined> {
    readonly type: Type;
    readonly name: Name;
    readonly args: Args;
}

/* Input extends FlowrSearchElements<Info>, Output extends FlowrSearchElements<Info> = Input */
export type FlowrSearchGeneratorNodeBase<Name extends string, Args extends Record<string, unknown> | undefined> = FlowrSearchNodeBase<'generator', Name, Args>;
export type FlowrSearchTransformerNodeBase<Name extends string, Args extends Record<string, unknown> | undefined> = FlowrSearchNodeBase<'transformer', Name, Args>;

export interface FlowrSearchGetFilters extends Record<string, unknown> {
    readonly line?:   number;
    readonly column?: number;
    readonly name?:   string;
    readonly id?:     NodeId;
}

export type FlowrSearchGeneratorNode = FlowrSearchGeneratorNodeBase<'all', undefined>
    | FlowrSearchGeneratorNodeBase<'get', FlowrSearchGetFilters>

export type FlowrSearchTransformerNode = FlowrSearchTransformerNodeBase<'first', undefined>
    | FlowrSearchTransformerNodeBase<'last', undefined>
    | FlowrSearchTransformerNodeBase<'index', { index: number }>
    | FlowrSearchTransformerNodeBase<'tail', undefined>
    | FlowrSearchTransformerNodeBase<'take', { count: number }>
    | FlowrSearchTransformerNodeBase<'skip', { count: number }>
    | FlowrSearchTransformerNodeBase<'filter', {
        filter: FlowrFilterExpression;
    }>

type MinimumInputForFlowrSearch<P extends Pipeline> =
    PipelineStepOutputWithName<P, 'normalize'> extends NormalizedAst ? (
        PipelineStepOutputWithName<P, 'dataflow'> extends DataflowGraph ? PipelineOutput<P>
            : never
    ): never

/** we allow any pipeline, which provides us with a 'normalize' and 'dataflow' step */
export type FlowrSearchInput<
    P extends Pipeline
> = MinimumInputForFlowrSearch<P>

/** Intentionally, we abstract away from an array to avoid the use of conventional typescript operations */
export class FlowrSearchElements<Info = NoInfo, Elements extends FlowrSearchElement<Info>[] = FlowrSearchElement<Info>[]> {
	private readonly elements: Elements = [] as unknown as Elements;

	public add(this: FlowrSearchElements<Info, Elements>, element: FlowrSearchElement<Info>): FlowrSearchElements<Info, FlowrSearchElement<Info>[]> {
		this.elements.push(element);
		return this;
	}

	public getElements(): readonly FlowrSearchElement<Info>[] {
		return this.elements;
	}
	/* TODO: conventional operations */
}

/* TODO: differentiate generators, transformer, and terminators */


