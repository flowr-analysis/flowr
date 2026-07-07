import { assert, describe, test } from 'vitest';
import { run } from '../utility/utility';
import { allPredefinedTaintAnalysisNames } from '../../../src/taint-analysis/predefined/predefined';
import type { LoggedFnCallInfo } from '../../../src/taint-analysis/eval/instrumentation';

type ParsedTrace = Record<string, Record<string, LoggedFnCallInfo>>;
type ParsedCallInfo = LoggedFnCallInfo['unmappedCalls'][number];

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

function findUnmappedCall(info: LoggedFnCallInfo, name: string): ParsedCallInfo {
	const call = info.unmappedCalls.find(c => c.functionName === name);
	assert.isDefined(call, `expected an unmapped call to ${name} to be logged`);
	return call;
}

/** The cds of a call without their (fixture-dependent) node ids. */
function cdConstructs(call: ParsedCallInfo) {
	return call.cds?.map(({ id: _, ...rest }) => rest);
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
		assert.deepEqual(sec.mappedCalls[0], { line: '2', nodeId: 2, functionName: 'read.table', args: [], taint: 'File Input' });
		assert.deepEqual(sec.mappedCalls[1], {
			line:         '4',
			nodeId:       19,
			functionName: 'source',
			args:         [
				{ taint: 'File Input' }, { value: 'someOtherArg' }, { name: 'namedArg', value: true }
			], taint: 'bottom' });

		assert.equal(sec.unmappedCalls.length, 2);
		assert.deepEqual(sec.unmappedCalls[0], {
			line:         '3',
			nodeId:       8,
			functionName: 'someunknown',
			args:         [ { value: 'argOfUnmapped' } ],
		});

		// the locally-defined function call carries its local definition target(s),
		// signalling that intraprocedural analysis could apply
		assert.deepEqual(sec.unmappedCalls[1], {
			line:         '6',
			nodeId:       32,
			functionName: 'myLocal',
			args:         [ { taint: 'bottom' } ],
			localTargets: [ 26 ],
		});

		// calls resolving to library/built-in functions carry no local targets
		assert.isUndefined(sec.mappedCalls[0].localTargets);
		assert.isUndefined(sec.unmappedCalls[0].localTargets);

		assert.deepEqual(output.result['security'], { 'domains': 'bottom', 'finding': 'User input potentially flowing to output' });
	});

	test('logs the control dependencies of guarded calls', async() => {
		const output = await getEvalOutput('test/system-tests/taint-eval/taint-eval-control-deps.R');

		const sec = Object.values(output.inferred['security'])[0];
		assert.isDefined(sec);

		// top-level calls and the conditions of `if`/`while` execute unconditionally
		assert.isUndefined(sec.mappedCalls[0].cds, 'expected no cds for the top-level read.table');
		assert.isUndefined(sec.mappedCalls[0].inEveryBranch);
		for(const name of ['isTRUE', 'running', 'stopifnot']) {
			assert.isUndefined(findUnmappedCall(sec, name).cds, `expected no cds for ${name}`);
		}

		// both branches of an `if` depend on the same node, with complementary `when` flags
		const guardedThen = findUnmappedCall(sec, 'guardedThen');
		const guardedElse = findUnmappedCall(sec, 'guardedElse');
		const ifId = guardedThen.cds?.[0].id;
		assert.isDefined(ifId);
		assert.deepEqual(guardedThen.cds, [{ id: ifId, construct: 'if', when: true }]);
		assert.deepEqual(guardedElse.cds, [{ id: ifId, construct: 'if', when: false }]);
		assert.isFalse(guardedThen.inEveryBranch);
		assert.isFalse(guardedElse.inEveryBranch);

		assert.deepEqual(cdConstructs(findUnmappedCall(sec, 'inFor')), [{ construct: 'for', when: true }]);
		assert.deepEqual(cdConstructs(findUnmappedCall(sec, 'inWhile')), [{ construct: 'while', when: true }]);
		assert.deepEqual(cdConstructs(findUnmappedCall(sec, 'inRepeat')), [{ construct: 'repeat' }, { construct: 'if', when: true }]);

		// the `stopifnot` cd points at the condition expression, i.e., the `is.numeric` call
		const condition = findUnmappedCall(sec, 'is.numeric');
		assert.deepEqual(findUnmappedCall(sec, 'afterStopifnot').cds, [{ id: condition.nodeId, construct: 'stopifnot', when: true }]);

		// the rhs of `&&` is evaluated lazily (and inherits the preceding stopifnot guard)
		assert.deepEqual(cdConstructs(findUnmappedCall(sec, 'lazyRhs')), [{ construct: '&&', when: true }, { construct: 'stopifnot', when: true }]);
	});
});
