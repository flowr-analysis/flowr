import { describe } from 'vitest';
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
});
