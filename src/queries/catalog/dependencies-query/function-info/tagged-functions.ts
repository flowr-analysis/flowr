import type { FunctionInfo } from './function-info';
import { Identifier } from '../../../../dataflow/environments/identifier';
import type { SemanticCallTag } from '../../../../dataflow/environments/built-in-props';
import type { BuiltInIndex } from '../../../../dataflow/environments/query-fn-props';

/**
 * The built-ins labeled `tag`, as the entries of a dependency category, so the dependency query and the built-in
 * configuration cannot disagree about them: the statistical tests are the ones labeled {@link SemanticCallTag.Statistics},
 * the calls needing an interactive session those labeled {@link SemanticCallTag.Interactive}. Every one of them names
 * the package it belongs to, which is what keeps `stats::t.test` a test and drops a `t.test` of somebody else's package.
 * Label a built-in with the tag and it shows up in the category.
 */
export function functionsTagged(index: BuiltInIndex, tag: SemanticCallTag): FunctionInfo[] {
	return index.with(tag).map(call => ({
		name:    Identifier.getName(call),
		package: Identifier.getNamespace(call)
	}));
}
