import { assert, describe, test } from 'vitest';
import { run } from '../utility/utility';
import { allPredefinedTaintAnalysisNames } from '../../../src/taint-analysis/predefined/predefined';
import type { LoggedFnCallInfo } from '../../../src/taint-analysis/eval/instrumentation';

type ParsedTrace = Record<string, Record<string, LoggedFnCallInfo>>;

interface EvalOutput {
	script_name: string;
	infer_time:  number;
	/** analysis name -\> file -\> collected calls */
	inferred:    ParsedTrace;
	result:      Record<string, unknown>;
}

function parseEvalOutput(stdout: string): EvalOutput {
	const line = stdout.trim().split('\n').filter(l => l.trim().length > 0).at(-1);
	assert.isDefined(line, `eval produced no output:\n${stdout}`);
	return JSON.parse(line) as EvalOutput;
}

async function getEvalOutput(script: string) {
	const stdout = await run(`npx ts-node --transpile-only src/taint-analysis/eval/eval.ts ${script}`);
	const output = parseEvalOutput(stdout);
	assert.isNumber(output.infer_time, 'expected an inference time to be reported');
	return output;
}

describe('taint-analysis evaluation', () => {
	test('analyzes a small R script and reports the expected taints', async() => {
		const output = await getEvalOutput('test/system-tests/taint-eval/taint-eval-small.R');

		// Assert all analyses exist
		for(const name of allPredefinedTaintAnalysisNames.filter(e => e !== 'determinism')) {
			assert.property(output.inferred, name);
			assert.property(output.inferred, name);

			assert.property(output.result, name);
			assert.property(output.result, name);
		}

		assert.equal(output.script_name, 'taint-eval-small.R');
		assert.exists(output.infer_time);
		assert.exists(output.inferred);
		assert.exists(output.result);

		const sec = Object.values(output.inferred['security'])[0];
		assert.isDefined(sec);

		assert.equal(sec.mappedCalls.length, 2);
		assert.deepEqual(sec.mappedCalls[0], { line: '2', nodeId: 2, functionName: 'read.table', args: [], taint: 'Network Input' });
		assert.deepEqual(sec.mappedCalls[1], {
			line:         '4',
			nodeId:       19,
			functionName: 'source',
			args:         [
				{ taint: 'Network Input' }, { value: 'someOtherArg' }, { name: 'namedArg', value: true }
			], taint: 'bottom' });

		assert.equal(sec.unmappedCalls.length, 1);
		assert.deepEqual(sec.unmappedCalls[0], {
			line:         '3',
			nodeId:       8,
			functionName: 'someunknown',
			args:         [ { value: 'argOfUnmapped' } ],
		});

		assert.deepEqual(output.result['security'], { 'domains': 'bottom', 'finding': 'User input potentially flowing to output' });
	});
});
