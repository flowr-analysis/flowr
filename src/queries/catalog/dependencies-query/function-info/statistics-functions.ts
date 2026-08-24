import type { FunctionInfo } from './function-info';
import { Identifier } from '../../../../dataflow/environments/identifier';
import { SemanticCallTag } from '../../../../dataflow/environments/built-in-props';
import { BuiltInIndex } from '../../../../dataflow/environments/query-fn-props';

/**
 * The statistical tests, read back from the {@link SemanticCallTag.Statistics} built-ins so the dependency query and
 * the built-in configuration cannot disagree about them. Every one of them names the package it belongs to,
 * which is what keeps `stats::t.test` a test and drops a `t.test` of somebody else's package.
 * Label a built-in `Statistics` and it shows up here.
 */
export function statisticsFunctions(index: BuiltInIndex = BuiltInIndex.default()): FunctionInfo[] {
	return index.with(SemanticCallTag.Statistics).map(call => ({
		name:    Identifier.getName(call),
		package: Identifier.getNamespace(call)
	}));
}
