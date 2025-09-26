import { assert, describe, test } from 'vitest';
import path from 'path';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import {
	FlowrAnalyzerDescriptionFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-description-file-plugin';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import type { PathLike } from 'fs';
import { FlowrFile } from '../../../../src/project/context/flowr-file';
import {
	FlowrAnalyzerPackageVersionsDescriptionFilePlugin
} from '../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-description-file-plugin';
import {
	FlowrAnalyzerLoadingOrderDescriptionFilePlugin
} from '../../../../src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-description-file-plugin';


class FakeFile extends FlowrFile<string> {
	private readonly contentStr: string;
    
	constructor(path: PathLike, content: string) {
		super(path);
		this.contentStr = content;
	}

	protected loadContent(): string {
		return this.contentStr;
	}
}

describe('DESCRIPTION-file', function() {
	const ctx = new FlowrAnalyzerContext(
		arraysGroupBy([
			new FlowrAnalyzerDescriptionFilePlugin(),
			new FlowrAnalyzerPackageVersionsDescriptionFilePlugin(),
			new FlowrAnalyzerLoadingOrderDescriptionFilePlugin()
		], p => p.type)
	);

	ctx.files.addFiles(new FakeFile(path.resolve('DESCRIPTION'), `Package: mypackage
Title: What the Package Does (One Line, Title Case)
Version: 0.0.0.9000
Authors@R:
    person("First", "Last", , "first.last@example.com", role = c("aut", "cre"))
Description: What the package does (one paragraph).
License: \`use_mit_license()\`, \`use_gpl3_license()\` or friends to pick a
    license
Encoding: UTF-8
Roxygen: list(markdown = TRUE)
RoxygenNote: 7.3.2
Description: The description of a package usually spans multiple lines.
    The second and subsequent lines should be indented, usually with four
    spaces.
URL: https://github.com/flowr-analysis/flowr
BugReports: https://github.com/flowr-analysis/flowr/issues
Depends:
    R (>= 4.0)
Imports:
    dplyr (>= 1.4.0),
    tidyr,
    ggplot2 (>= 2.5.8),
    ads (>= 0.8.1)
Suggests:
    sf (>= 0.8-1),
    tibble,
    testthat (>= 2.1.5),
    svglite (>= 1.1.2),
    xml2
    vdiffr (>= 1.5.6),
Enhances:
    something
LazyData: true
Collate:
    'aaa.R'
    'main.R'
    'zzz.R'`));
	ctx.files.addRequest({ request: 'file', content: 'pete.R' });
	ctx.resolvePreAnalysis();
	describe.sequential('Parsing', function() {
		test('Library-Versions-Plugin', () => {
			const deps = ctx.deps.getDependency('dplyr');
			assert.isDefined(deps);
			assert.isTrue(deps.derivedVersion?.test('1.4.0'));
		});

		test('Loading-Order-Plugin', () => {
			const order = ctx.files.computeLoadingOrder();
			assert.isNotEmpty(order);
			assert.deepStrictEqual(order[0], { request: 'file', content: 'pete.R' });
		});
	});
});