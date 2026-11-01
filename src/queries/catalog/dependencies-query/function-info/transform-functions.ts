import type { FunctionInfo } from './function-info';
import { Identifier } from '../../../../dataflow/environments/identifier';
import { SemanticCallTag } from '../../../../dataflow/environments/built-in-props';
import type { BuiltInIndex } from '../../../../dataflow/environments/query-fn-props';

/**
 * The calls that reshape, filter, join or aggregate data, read back from the {@link SemanticCallTag.Transforms}
 * built-ins. Every one of them names its package, so `filter` only counts when it resolves to dplyr and never
 * for the time-series `stats::filter`. Label a built-in `Transforms` and it shows up here.
 */
export function transformFunctions(index: BuiltInIndex): FunctionInfo[] {
	return index.with(SemanticCallTag.Transforms).map(call => ({
		name:    Identifier.getName(call),
		package: Identifier.getNamespace(call)
	}));
}
