import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import {
	FlowrAnalyzerDescriptionFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-description-file-plugin';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import {
	FlowrAnalyzerPackageVersionsDescriptionFilePlugin
} from '../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-description-file-plugin';
import {
	FlowrAnalyzerLoadingOrderDescriptionFilePlugin
} from '../../../../src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-description-file-plugin';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { defaultConfigOptions } from '../../../../src/config';


describe('DESCRIPTION-file', function() {
	const ctx = new FlowrAnalyzerContext(
		defaultConfigOptions,
		arraysGroupBy([
			new FlowrAnalyzerDescriptionFilePlugin(),
			new FlowrAnalyzerPackageVersionsDescriptionFilePlugin(),
			new FlowrAnalyzerLoadingOrderDescriptionFilePlugin()
		], p => p.type)
	);

	ctx.addFile(new FlowrInlineTextFile('DESCRIPTION', `Package: mypackage
Title: What the Package Does (One Line, Title Case)
Version: 0.0.0.9000
Authors@R:
    person("First", "Last", , "first.last@example.com", role = c("aut", "cre"))
Description: What the package does (one paragraph).
License: MIT + file LICENSE
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
	ctx.addFile(new FlowrInlineTextFile('pete.R', 'x <- 2'));
	ctx.addFile(new FlowrInlineTextFile('another/DESCRIPTION', `Package: mypackage
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
`));
	ctx.addRequests([{ request: 'file', content: 'pete.R' }]);
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

		test('License parsing', () => {
			const descFile = ctx.files.getFilesByRole(FileRole.Description);
			assert.lengthOf(descFile, 2);
			const descContent = descFile[0];
			const license = descContent.license();
			assert.isDefined(license);
			assert.lengthOf(license, 1);
			const [first] = license;
			assert.deepStrictEqual(first, { conjunction: 'and', left: { license: 'MIT' }, right: { license: 'LicenseRef-FILE' } });
		});

		test('Broken license parsing', () => {
			const descFile = ctx.files.getFilesByRole(FileRole.Description);
			assert.lengthOf(descFile, 2);
			const descContent = descFile[1];
			const license = descContent.license();
			assert.isDefined(license);
			assert.lengthOf(license, 0);
		});
	});
});