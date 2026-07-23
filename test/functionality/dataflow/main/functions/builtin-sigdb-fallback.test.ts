import { describe, test, expect } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';
import { FlowrConfig } from '../../../../../src/config';
import { DataflowMermaid } from '../../../../../src/util/mermaid/dfg';

/**
 * The built-in argument matchers (`with`, `load`) draw their formal parameter names from the signature database
 * (see `signatureParamNames`), but must fall back to the hardcoded formals when no sigdb is available -- and that
 * fallback has to be behavior-identical, so disabling the database never changes a dataflow graph. We NEVER want
 * the database wired into the graph, only into which argument fills which formal.
 */
describe('built-in arg matching falls back to hardcoded formals without a sigdb', withTreeSitter(parser => {
	async function mermaidOf(code: string, sigdb: boolean): Promise<string> {
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.solver.sigdb.enabled = sigdb;
		});
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).setConfig(config).build();
		analyzer.addRequest(requestFromInput(code));
		return DataflowMermaid.raw((await analyzer.dataflow()).graph, false);
	}

	test.each([
		'with(d, x + y)',
		'within(d, { x <- 1 })',
		'load("f.rda")',
		'load(file = "f.rda", envir = e)'
	])('%s yields the same graph with and without the database', async(code) => {
		expect(await mermaidOf(code, false)).toStrictEqual(await mermaidOf(code, true));
	});
}));
