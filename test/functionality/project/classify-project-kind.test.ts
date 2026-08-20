import { assert, describe, test } from 'vitest';
import { classifyProjectKind, resolveClassifyOptions, type ProjectKindSignals } from '../../../src/project/context/classify-project-kind';
import { ProjectKind } from '../../../src/project/context/project-kind';

/** build {@link ProjectKindSignals} from a plain map of basename to content (shiny entries readable, DESCRIPTIONs typed) */
function signals(files: Record<string, string>, descriptionTypes: string[] = []): ProjectKindSignals {
	const names = new Set(Object.keys(files).map(n => n.toLowerCase()));
	const entries = new Map<string, () => string | undefined>();
	for(const [name, content] of Object.entries(files)) {
		const lower = name.toLowerCase();
		if(['app.r', 'ui.r', 'server.r', 'global.r'].includes(lower)) {
			entries.set(lower, () => content);
		}
	}
	return { names, entries, descriptionTypes, descriptionCount: descriptionTypes.length };
}

describe('classifyProjectKind', () => {
	test('a DESCRIPTION Type: shiny is a shiny app', () => {
		assert.strictEqual(classifyProjectKind(signals({ 'DESCRIPTION': '' }, ['shiny'])), ProjectKind.ShinyApp);
	});

	test('app.R using shiny is a shiny app', () => {
		assert.strictEqual(classifyProjectKind(signals({ 'app.R': 'library(shiny)\nshinyApp(ui, server)' })), ProjectKind.ShinyApp);
	});

	test('a ui.R + server.R pair that uses shiny is a shiny app', () => {
		assert.strictEqual(classifyProjectKind(signals({ 'ui.R': 'fluidPage()', 'server.R': 'function(input,output){}' })), ProjectKind.ShinyApp);
	});

	test('a ui.R + server.R pair that never touches shiny is a project', () => {
		assert.strictEqual(classifyProjectKind(signals({ 'ui.R': 'x <- 1', 'server.R': 'y <- 2' })), ProjectKind.Project);
	});

	test('a DESCRIPTION without a shiny type is a package', () => {
		assert.strictEqual(classifyProjectKind(signals({ 'DESCRIPTION': '', 'foo.R': 'x<-1' }, ['package'])), ProjectKind.Package);
	});

	test('no files at all is unknown', () => {
		assert.strictEqual(classifyProjectKind(signals({})), ProjectKind.Unknown);
	});

	test('a notebook is detected by its extension', () => {
		assert.strictEqual(classifyProjectKind(signals({ 'report.Rmd': 'x<-1' })), ProjectKind.Notebook);
	});

	test('a single R file is a script', () => {
		assert.strictEqual(classifyProjectKind(signals({ 'run.R': 'x<-1' })), ProjectKind.Script);
	});

	test('several R files without a package are a project', () => {
		assert.strictEqual(classifyProjectKind(signals({ 'a.R': 'x<-1', 'b.R': 'y<-2' })), ProjectKind.Project);
	});

	test('configuration can extend the notebook extensions and shiny types', () => {
		const opts = resolveClassifyOptions({ notebookExtensions: ['myst'], shinyDescriptionTypes: ['dashboard'] });
		assert.strictEqual(classifyProjectKind(signals({ 'report.myst': 'x' }), opts), ProjectKind.Notebook);
		assert.strictEqual(classifyProjectKind(signals({ 'DESCRIPTION': '' }, ['dashboard']), opts), ProjectKind.ShinyApp);
		// the built-in default no longer recognizes the custom notebook extension
		assert.strictEqual(classifyProjectKind(signals({ 'report.myst': 'x' })), ProjectKind.Script);
	});
});
