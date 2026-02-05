import { assert, describe, test } from 'vitest';
import type { SweaveBlockOptions } from '../../../../src/project/plugins/file-plugins/files/flowr-sweave-file';
import { FlowrSweaveFile, parseSweave, parseSweaveCodeblockStart } from '../../../../src/project/plugins/file-plugins/files/flowr-sweave-file';
import { testFileLoadPlugin } from './plugin-test-helper';
import { FlowrAnalyzerSweaveFilePlugin } from '../../../../src/project/plugins/file-plugins/notebooks/flowr-analyzer-sweave-file-plugin';

describe('sweave file', () => {
	describe('parse code block start', () => {
		test.each([
			['Mean LaTex Line', '\\someMacro{Test}',     undefined],
			['Mean LaTex Line', '\\someMacro{<<>>=}',    undefined],
			['Unnamed Block',   '<<>>=',                 {}],
			['Comment',         '<<>>= test 1 2 3',      {}],
			['Named Block',     '<<test>>=',             { name: 'test', eval: undefined }],
			['Eval True',       '<<eval=TRUE>>=',        { name: undefined, eval: true  }],
			['Eval False',      '<<eval=FALSE>>=',       { name: undefined, eval: false }],
			['Eval With Name',  '<<test, eval=FALSE>>=', { name: 'test', eval: false }],
		] satisfies [string, string, SweaveBlockOptions | undefined][])('$0', (_, line, expected) => {
			const result = parseSweaveCodeblockStart(line);
			assert.deepEqual(result, expected);
		});
	});


	describe('parse code block', () => {
		test('parse unnamed', () => {
			const block = `G <- hyperframe(X=1:3, Y=letters[1:3], Z=factor(letters[1:3]),
                W=list(rpoispp(100),rpoispp(100), rpoispp(100)),
                U=42,
                V=rpoispp(100), stringsAsFactors=FALSE)
G`;

			const input = `\\code{hyperframe}. This is the same behaviour as for the function
\\code{data.frame}.

<<>>=
${block}
@

This hyperframe has 3 rows and 6 columns.

`;
			const result = parseSweave(input);
			assert(result.blocks.length === 1);
			assert.equal(result.blocks[0].content, `${block}\n`);
			assert(result.blocks[0].options.name === undefined);
			assert(result.blocks[0].options.eval === undefined);
		});
	});

	describe('Parse Entire File', async() => {
		const exampleWithoutLatex = `plot(waterstriders, main="")


fit <- mppm(P ~ x, hyperframe(P=waterstriders))
res <- residuals(fit)
totres <- sapply(res, integral.msr)
`;

		await testFileLoadPlugin(FlowrAnalyzerSweaveFilePlugin, FlowrSweaveFile, 'test/testfiles/notebook/example.Rnw', exampleWithoutLatex);
	});
});
