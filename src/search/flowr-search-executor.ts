import type { FlowrSearchLike } from './flowr-search-builder';
import type {
	FlowrSearchElement,
	FlowrSearchInput } from './flowr-search';


import type { Pipeline } from '../core/steps/pipeline/pipeline';
import type { NoInfo } from '../r-bridge/lang-4.x/ast/model/model';


// TODO: specialize output type
export function runSearch<P extends Pipeline>(
	search: FlowrSearchLike,
	data: FlowrSearchInput<P>
): FlowrSearchElement<NoInfo>[] {

	return [];
}
