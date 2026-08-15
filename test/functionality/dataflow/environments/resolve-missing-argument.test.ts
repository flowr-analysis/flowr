import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';
import { resolveIdToValue } from '../../../../src/dataflow/eval/resolve/alias-tracking';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import { isTop } from '../../../../src/dataflow/eval/values/r-value';

/** `f(x=)` is valid R: the argument is named but missing, so it carries no value to resolve. */
describe('Resolve', withTreeSitter(ts => {
	test(label('a missing argument resolves to top instead of throwing', ['name-normal', 'function-calls'], ['resolve']), async() => {
		const context = contextFromInput('f(x=)');
		const analysis = await createDataflowPipeline(ts, { context }).allRemainingSteps();
		const idMap = analysis.dataflow.graph.idMap;
		const missing = [...idMap ?? []].find(([, n]) => n.type === RType.Argument && n.value === undefined);
		assert.isDefined(missing, 'the snippet has to produce a valueless argument');
		const value = resolveIdToValue(missing[0], {
			graph:       analysis.dataflow.graph,
			idMap,
			environment: analysis.dataflow.environment,
			ctx:         context
		});
		assert.isTrue(isTop(value));
	});
}));
