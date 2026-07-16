import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../src/project/context/flowr-analyzer-context';
import { ProjectKind } from '../../../src/project/context/flowr-analyzer-files-context';
import { FlowrConfig } from '../../../src/config';
import { FlowrInlineTextFile, FileRole } from '../../../src/project/context/flowr-file';
import { FlowrDescriptionFile } from '../../../src/project/plugins/file-plugins/files/flowr-description-file';

/** a context holding the given files; a `DESCRIPTION` entry is lifted so its `Type` field is readable */
function contextWith(...files: [name: string, content: string, description?: boolean][]): FlowrAnalyzerContext {
	const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), new Map());
	for(const [name, content, description] of files) {
		ctx.addFile(description
			? FlowrDescriptionFile.from(new FlowrInlineTextFile(name, content), FileRole.Description)
			: new FlowrInlineTextFile(name, content));
	}
	return ctx;
}

describe('Project kind', () => {
	test('an explicit `Type: shiny` in the DESCRIPTION marks a shiny app', () => {
		assert.strictEqual(contextWith(['DESCRIPTION', 'Package: a\nType: Shiny\n', true]).projectKind(), ProjectKind.ShinyApp);
	});

	test('a single app.R that loads shiny is a shiny app', () => {
		assert.strictEqual(contextWith(['app.R', 'library(shiny)\nshinyApp(ui, server)']).projectKind(), ProjectKind.ShinyApp);
	});

	test('a ui.R + server.R pair that uses shiny is a shiny app', () => {
		assert.strictEqual(contextWith(['ui.R', 'fluidPage()'], ['server.R', 'function(input, output) {}']).projectKind(), ProjectKind.ShinyApp);
	});

	test('bslib/shinydashboard entry points count as shiny', () => {
		assert.strictEqual(contextWith(['app.R', 'library(bslib)\npage_sidebar()']).projectKind(), ProjectKind.ShinyApp);
	});

	test('a ui.R + server.R pair that never touches shiny is not a shiny app', () => {
		// a coincidental pair must not be mistaken for an app just by its file names
		assert.strictEqual(contextWith(['ui.R', 'x <- 1'], ['server.R', 'y <- 2']).projectKind(), ProjectKind.Project);
	});

	test('a lone server.R is not a shiny app', () => {
		// a non-shiny project may well have a server.R; the ui.R + server.R pair (or app.R) is what marks an app
		assert.strictEqual(contextWith(['server.R', 'library(shiny)\nx <- 1']).projectKind(), ProjectKind.Script);
	});

	test('an app.R that does not use shiny is just a script', () => {
		assert.strictEqual(contextWith(['app.R', 'x <- 1']).projectKind(), ProjectKind.Script);
	});

	test('a DESCRIPTION without a shiny type is a package', () => {
		assert.strictEqual(contextWith(['DESCRIPTION', 'Package: a\nType: Package\n', true]).projectKind(), ProjectKind.Package);
	});

	test('an empty context is unknown', () => {
		assert.strictEqual(new FlowrAnalyzerContext(FlowrConfig.default(), new Map()).projectKind(), ProjectKind.Unknown);
	});

	test('a notebook is detected by its extension', () => {
		assert.strictEqual(contextWith(['report.Rmd', 'x <- 1']).projectKind(), ProjectKind.Notebook);
	});

	test('the result is cached and invalidated when a file is added', () => {
		const ctx = contextWith(['helper.R', 'x <- 1']);
		assert.strictEqual(ctx.projectKind(), ProjectKind.Script);
		ctx.files.addFile(new FlowrInlineTextFile('app.R', 'library(shiny)\nshinyApp(1, 2)'));
		assert.strictEqual(ctx.projectKind(), ProjectKind.ShinyApp, 'adding a file must invalidate the cached kind');
	});
});
