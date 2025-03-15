import { assert, describe, test } from 'vitest';
import type { Value } from '../../../../src/dataflow/eval/values/r-value';
import { Top , stringifyValue } from '../../../../src/dataflow/eval/values/r-value';
import { withShell } from '../../_helper/shell';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { evalRExpression } from '../../../../src/dataflow/eval/eval';
import { initializeCleanEnvironments } from '../../../../src/dataflow/environments/environment';
import {
	intervalFrom,
	intervalFromValues,
	ValueIntervalMinusOneToOne
} from '../../../../src/dataflow/eval/values/intervals/interval-constants';
import { getScalarFromInteger } from '../../../../src/dataflow/eval/values/scalar/scalar-constants';
import { stringFrom } from '../../../../src/dataflow/eval/values/string/string-constants';
import { binaryValue } from '../../../../src/dataflow/eval/values/value-binary';
import { isTruthy } from '../../../../src/dataflow/eval/values/logical/logical-check';

describe.sequential('eval', withShell(shell => {
	function assertEval(code: string, expect: Value) {
		test(code + ' => ' + stringifyValue(expect), async() => {
			const results = await createDataflowPipeline(shell, {
				request: requestFromInput(code)
			}).allRemainingSteps();
			const result = evalRExpression(results.normalize.ast, results.dataflow.graph, initializeCleanEnvironments());
			const isExpected = binaryValue(result, '===', expect);
			assert.isTrue(isTruthy(isExpected).value === true,
				`Expected ${stringifyValue(result)} to be ${stringifyValue(expect)} (${stringifyValue(isExpected)})`
			);
		});
	}

	describe('constants and simple math', () => {
		assertEval('1L', intervalFromValues(getScalarFromInteger(1, true)));
		assertEval('1', intervalFromValues(getScalarFromInteger(1, false)));
		assertEval('-1', intervalFromValues(getScalarFromInteger(-1, false)));
		assertEval('1 + 2', intervalFromValues(getScalarFromInteger(3, false)));
		assertEval('1 + 2 * 7 - 8', intervalFromValues(getScalarFromInteger(7, false)));
		assertEval('"foo"', stringFrom('foo'));
	});
	describe('Use variables', () => {
		assertEval('u', Top);
		assertEval('sign(u)', ValueIntervalMinusOneToOne);
		assertEval('abs(sign(u)) + 1', intervalFrom(1, 2, true, true));
	});
}));