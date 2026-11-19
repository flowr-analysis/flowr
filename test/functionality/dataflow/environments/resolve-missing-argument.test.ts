import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { isTop } from '../../../../src/dataflow/eval/values/r-value';
import { Resolve } from '../../../../src/dataflow/environments/resolve-helper';
import { RArgument } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { analyze } from '../../_helper/analyzer';

/** `f(x=)` is valid R: the argument is named but missing, so it carries no value to resolve. */
describe('Resolve', withTreeSitter(ts => {
	test(label('a missing argument resolves to top instead of throwing', ['name-normal', 'function-calls'], ['resolve']), async() => {
		const analyzer = await analyze(ts, 'f(x=)');
		const dataflow = await analyzer.dataflow();
		const idMap = dataflow.graph.idMap;
		const missing = [...idMap ?? []].find(([, n]) => RArgument.is(n) && n.value === undefined);
		assert.isDefined(missing, 'the snippet has to produce a valueless argument');
		const value = Resolve.toValue(missing[0], {
			graph:       dataflow.graph,
			idMap,
			environment: dataflow.environment,
			ctx:         analyzer.inspectContext()
		});
		assert.isTrue(isTop(value));
	});
}));
