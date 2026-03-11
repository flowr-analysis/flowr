import { describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { RProject } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-project';

describe('Incremental Parsing', () => {
	test('should ', async() => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setEngine('tree-sitter')
			.build();
		const f = new FlowrInlineTextFile('a.R', 'x <- 42\nprint(x)');
		analyzer.addFile(f);
		analyzer.addRequest({ request: 'file', content: 'a.R' });

		console.log(RProject.collectAllIds((await analyzer.normalize()).ast));

		f.updateInlineContent('x <- 42\ny <- 32\nprint(x)');

		console.log(RProject.collectAllIds((await analyzer.normalize()).ast));
	});
});