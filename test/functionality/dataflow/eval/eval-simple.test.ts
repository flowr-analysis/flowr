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
	intervalFromValues, ValueIntervalMinusOneToOne
} from '../../../../src/dataflow/eval/values/intervals/interval-constants';
import {
	getScalarFromInteger, ValueNumberPositiveInfinity
} from '../../../../src/dataflow/eval/values/scalar/scalar-constants';
import { stringFrom } from '../../../../src/dataflow/eval/values/string/string-constants';
import { binaryValue } from '../../../../src/dataflow/eval/values/value-binary';
import { toTruthy } from '../../../../src/dataflow/eval/values/logical/logical-check';
import { ValueLogicalMaybe } from '../../../../src/dataflow/eval/values/logical/logical-constants';
import { setFrom } from '../../../../src/dataflow/eval/values/sets/set-constants';
import { vectorFrom } from '../../../../src/dataflow/eval/values/vectors/vector-constants';

describe.sequential('eval', withShell(shell => {
	function assertEval(code: string, expect: Value) {
		test(code + ' => ' + stringifyValue(expect), async() => {
			const results = await createDataflowPipeline(shell, {
				request: requestFromInput(code)
			}).allRemainingSteps();
			const result = evalRExpression(results.normalize.ast, results.dataflow.graph, initializeCleanEnvironments());
			const isExpected = binaryValue(result, '===', expect);
			assert.isTrue(toTruthy(isExpected).value === true,
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
		assertEval('c(1L, 2L)', vectorFrom({ elements: [intervalFrom(1, 1), intervalFrom(2,2)] }));
		assertEval('c(1L, 2 * 7)', vectorFrom({ elements: [intervalFrom(1, 1), intervalFrom(14, 14)] }));
		assertEval('c(1L, c(2L))', vectorFrom({ elements: [intervalFrom(1, 1), intervalFrom(2,2)] }));
		assertEval('c(1L, c(2L,3L), 4L)', vectorFrom({ elements: [intervalFrom(1, 1), intervalFrom(2,2), intervalFrom(3,3), intervalFrom(4,4)] }));
	});
	describe('Use variables', () => {
		assertEval('u', Top);
		assertEval('sign(u)', setFrom(ValueIntervalMinusOneToOne));
		assertEval('sign(u) > 2', ValueLogicalMaybe);
		assertEval('sign(runif(2)) > 2', vectorFrom({ elements: Top, domain: ValueLogicalMaybe }));
		assertEval('abs(u) + 1', intervalFromValues(getScalarFromInteger(1, false), ValueNumberPositiveInfinity));
		assertEval('abs(sign(u)) + 1', intervalFromValues(getScalarFromInteger(1, false), getScalarFromInteger(2, false)));
	});
	describe('Strings', () => {
		assertEval('"foo"', stringFrom('foo'));
		assertEval('paste("foo", "bar")', stringFrom('foo bar'));
		assertEval('paste0("foo", "bar")', stringFrom('foobar'));
	});
}));