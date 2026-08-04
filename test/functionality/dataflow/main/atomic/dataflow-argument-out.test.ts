import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';
import { label } from '../../../_helper/label';

describe('Definitions written inside an argument', withTreeSitter(ts => {
	async function outNamesOf(code: string): Promise<string[]> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(requestFromInput(code));
		const df = await analyzer.dataflow();
		return df.out.map(({ name }) => name === undefined ? '<anonymous>' : Identifier.toString(name));
	}

	// every expectation here was verified against real R via `exists("x", envir=e, inherits=FALSE)`
	test.each([
		{ code: 'x <- 1', why: 'a plain assignment' },
		{ code: '(x <- 1)', why: 'an assignment wrapped in parentheses' },
		{ code: '{x <- 1}', why: 'an assignment wrapped in braces' },
		{ code: '((x <- 1))', why: 'an assignment wrapped twice' },
		{ code: 'invisible(x <- 1)', why: 'invisible, which forces its argument' },
		{ code: 'print(x <- 1)', why: 'print, which forces its argument' },
		{ code: 'message(x <- 1)', why: 'message, which forces its argument' },
		{ code: 'force(x <- 1)', why: 'force, which is exactly its evaluated argument' },
		{ code: 'identity(x <- 1)', why: 'identity, which is exactly its evaluated argument' },
	])('$why ($code) defines x in the enclosing scope', async({ code }) => {
		expect(await outNamesOf(code)).toContain('x');
	});

	test(label('an arbitrary call does not expose the definitions of its arguments', ['unnamed-arguments'], ['dataflow']), async() => {
		// `f` may well never evaluate its argument, so only builtins known to force it may opt in
		expect(await outNamesOf('f(x <- 1)')).not.toContain('x');
	});
}));
