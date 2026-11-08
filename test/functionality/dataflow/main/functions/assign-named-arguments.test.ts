import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';

/* R binds these by name, as `Rscript -e 'x <- new.env(); assign("f", envir = x, value = 1); get("f", envir = x)'` shows */
describe('assign binds its arguments as R does', withTreeSitter(ts => {
	async function sliced(code: string): Promise<string> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(requestFromInput(code));
		const { results } = (await analyzer.query([{ type: 'static-slice', criteria: [`${code.split('\n').length}:1`] }]))['static-slice'];
		return Object.values(results)[0].reconstruct?.code as string;
	}
	test.each([
		'assign("f", v, envir = x)', 'assign("f", envir = x, value = v)', 'assign(envir = x, value = v, x = "f")', 'assign(value = v, "f", envir = x)'
	])('%s keeps the value', async call => {
		assert.include(await sliced(`v <- 1\nx <- new.env()\n${call}\nprint(get("f", envir = x))`), 'v <- 1');
	});
	test('inherits is no environment written into', async() => {
		assert.notInclude(await sliced('h <- FALSE\nx <- new.env()\nassign("f", 1, envir = x, inherits = h)\nprint(h)'), 'assign');
	});
}));
