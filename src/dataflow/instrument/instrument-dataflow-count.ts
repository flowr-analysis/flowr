import type { DataflowProcessors } from '../processor';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { DataflowInformation } from '../info';

/**
 * This takes the out parameter `countMap` and fills it with the count of how many times each RType was processed.
 * The accompanying `reset` function can be used to reset the map to an empty state.
 */
export function instrumentDataflowCount(countMap: Map<RType, number>, reset: (map: Map<RType, number>) => void): (extractor: DataflowProcessors<ParentInformation>, ctx: FlowrAnalyzerContext) => DataflowProcessors<ParentInformation> {
	return (extractor, _ctx) => {
		reset(countMap);
		const instrumented: DataflowProcessors<ParentInformation> = {} as DataflowProcessors<ParentInformation>;
		for(const [key, processor] of Object.entries(extractor) as [RType, (...args: unknown[]) => DataflowInformation][]) {
			instrumented[key as RNode['type']] = ((...args: unknown[]) => {
				const prev = countMap.get(key) ?? 0;
				countMap.set(key, prev + 1);
				return processor(...args);
			}) as never;
		}
		return instrumented;
	};
}