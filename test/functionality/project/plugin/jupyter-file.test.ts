import { assert, describe, test } from 'vitest';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { testFileLoadPlugin } from './plugin-test-helper';
import { FlowrAnalyzerJupyterFilePlugin } from '../../../../src/project/plugins/file-plugins/notebooks/flowr-analyzer-jupyter-file-plugin';
import { FlowrJupyterFile } from '../../../../src/project/plugins/file-plugins/files/flowr-jupyter-file';

describe('Jupyter-file', async() => {
	await testFileLoadPlugin(FlowrAnalyzerJupyterFilePlugin, FlowrJupyterFile, 'test/testfiles/notebook/example.ipynb', `x <- 5
cat(x)
# # Hello
# This is a cool test
y <- c(1,2,3)
plot(y)
# Hi`, ['file:ipynb']);
	test('a text cell stored as one string is a comment on every line', () => {
		const notebook = JSON.stringify({ cells: [
			{ cell_type: 'markdown', source: '# Title\nsome prose\n\nmore' },
			{ cell_type: 'code', source: 'x <- 1\nx' }
		] });
		assert.strictEqual(String(FlowrJupyterFile.from(new FlowrInlineTextFile('n.ipynb', notebook)).content()), '# # Title\n# some prose\n# \n# more\nx <- 1\nx');
	});
});
