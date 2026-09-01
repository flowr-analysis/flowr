import { assert, describe, test } from 'vitest';
import { discoverRSourcesRegex } from '../../../../src/project/plugins/project-discovery/flowr-analyzer-project-discovery-plugin';
import { FlowrRMarkdownFile } from '../../../../src/project/plugins/file-plugins/files/flowr-rmarkdown-file';
import { testFileLoadPlugin } from './plugin-test-helper';
import { FlowrAnalyzerRmdFilePlugin } from '../../../../src/project/plugins/file-plugins/notebooks/flowr-analyzer-rmd-file-plugin';
import { FlowrAnalyzerQmdFilePlugin } from '../../../../src/project/plugins/file-plugins/notebooks/flowr-analyzer-qmd-file-plugin';

const testFileSourceWithoutMd = '\n\n\n\n\n\n\n\n\n\n' +
      'test <- 42\n' +
      'cat(test)\n' +
      '\n\n\n\n' +
      'x <- "Hello World"\n' +
      '\n\n\n\n' +
      '  cat("Hi")\n' +
      '\n\n\n\n\n' +
      '#| cache=FALSE\n' +
      'cat(test)\n' +
      '\n\n\n\n\n\n\n\n\n' +
      'v <- c(1,2,3)\n' +
      '\n\n\n';

describe('RMarkdown-file', async() => {
	await testFileLoadPlugin(FlowrAnalyzerRmdFilePlugin, FlowrRMarkdownFile, 'test/testfiles/notebook/example.Rmd', testFileSourceWithoutMd, ['file:rmd']);
	await testFileLoadPlugin(FlowrAnalyzerRmdFilePlugin, FlowrRMarkdownFile, 'test/testfiles/notebook/example-rif.Rmd', '\n\n' + testFileSourceWithoutMd, ['file:rmd']);
});

describe('Quarto RMarkdown-file', async() => {
	await testFileLoadPlugin(FlowrAnalyzerQmdFilePlugin, FlowrRMarkdownFile, 'test/testfiles/notebook/example.Rmd', testFileSourceWithoutMd, ['file:qmd']);
});

describe('RMarkdown file extensions', () => {
	const plugin = new FlowrAnalyzerRmdFilePlugin();
	test.each([
		['doc.Rmd', true],
		['doc.rmd', true],
		['doc.Rmarkdown', true],
		['doc.rmarkdown', true],
		['doc.md', false],
		['doc.qmd', false]
	])('%s is handled by the rmd plugin: %s', (name, expected) => {
		assert.equal(plugin.applies(name), expected);
		if(expected) {
			assert.isTrue(discoverRSourcesRegex.test(name), 'must also be discovered as an R source');
		}
	});
});
