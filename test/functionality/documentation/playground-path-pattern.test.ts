import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { RArgument } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { pathPattern } from '../../../scripts/playground/dependency-view';

describe('the path an unknown file name builds', withTreeSitter(ts => {
	test.each([
		['file.path("figures/out", paste0(name, ".csv"))', 'figures/out/<name>.csv'],
		['paste0("plot-", i, ".png")', 'plot-<i>.png'],
		['paste("a", b)', 'a <b>'],
		['sprintf("out/%s.pdf", name)', 'out/<name>.pdf'],
		['sprintf("out/%03d.pdf", i)', undefined],
		['paste0(name, ".csv", collapse = "")', undefined],
		['tolower(name)', undefined]
	])('%s', async(code, expected) => {
		const analyzer = new FlowrAnalyzerBuilder().setParser(ts).buildSync();
		analyzer.addRequest(requestFromInput(`write.csv(d, ${code})`));
		const ast = await analyzer.normalize();
		const call = ast.ast.files[0].root.children[0] as { arguments: readonly unknown[] };
		expect(pathPattern(RArgument.valueOf(call.arguments[1] as never))).toBe(expected);
	});
}));
