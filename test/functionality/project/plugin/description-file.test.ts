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
import { AuthorRole } from '../../../../src/util/r-author';
import type { FlowrDescriptionFile } from '../../../../src/project/plugins/file-plugins/files/flowr-description-file';

const DescriptionA = `Package: mypackage
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
    'zzz.R'`;
const DescriptionB = `Package: Sample
Type: Package
Title: Record Linkage and Epidemiological Case Definitions in 'R'
Date: 2025-12-31
Version: 0.42.33
URL: https://AUTH.github.io/diyar/index.html
BugReports: https://github.com/AUTH/diyar/issues
Author: Author Surname
Maintainer: Firstname Lastname <firstname.lastname@gmail.com>
Description: An R package ...
License: GPL-3
Encoding: UTF-8
LazyData: true
Imports: methods, utils, ggplot2, rlang
RoxygenNote: 7.2.3
Suggests: knitr, rmarkdown, testthat, covr
VignetteBuilder: knitr
Language: en-GB
NeedsCompilation: no
Packaged: 2025-12-31 22:50:00 UTC Master of Desaster
Depends: R (>= 3.5.0)
Repository: CRAN
Date/Publication: 2025-12-31 23:00:00 UTC
`;

function contextWithFile(desc: string): FlowrAnalyzerContext {
	const ctx = new FlowrAnalyzerContext(
		defaultConfigOptions,
		arraysGroupBy([
			new FlowrAnalyzerDescriptionFilePlugin(),
			new FlowrAnalyzerPackageVersionsDescriptionFilePlugin(),
			new FlowrAnalyzerLoadingOrderDescriptionFilePlugin()
		], p => p.type)
	);

	ctx.addFile(new FlowrInlineTextFile('DESCRIPTION', desc));
	ctx.addFile(new FlowrInlineTextFile('pete.R', 'x <- 2'));
	ctx.addRequests([{ request: 'file', content: 'pete.R' }]);
	ctx.resolvePreAnalysis();
	return ctx;
}

function getDescContent(ctx: FlowrAnalyzerContext): FlowrDescriptionFile {
	const descFile = ctx.files.getFilesByRole(FileRole.Description);
	assert.lengthOf(descFile, 1);
	return descFile[0];
}

describe('DESCRIPTION-file', function() {
	describe('Variant A', () => {
		const ctx = contextWithFile(DescriptionA);
		test('Library-Versions-Plugin', () => {
			assert.isTrue(
				ctx.deps.getDependency('dplyr')
					?.derivedVersion
					?.test('1.4.0')
			);
		});
		test('Loading-Order-Plugin', () => {
			assert.deepStrictEqual(
				ctx.files.computeLoadingOrder()[0],
				{ request: 'file', content: 'pete.R' }
			);
		});
		test('License parsing', () => {
			const license = getDescContent(ctx).license();
			assert.isDefined(license);
			assert.lengthOf(license, 1);
			const [first] = license;
			assert.deepStrictEqual(first, {
				type:        'combination',
				combination: 'and',
				elements:    [
					{ type: 'license', license: 'MIT' },
					{ type: 'license', license: 'file LICENSE' }
				]
			});
		});
		test('Author retrieval', () => {
			const authors = getDescContent(ctx).authors();
			assert.isDefined(authors);
			assert.lengthOf(authors, 1);
			const [first] = authors;
			assert.deepStrictEqual(first, {
				name:  ['First', 'Last'],
				email: 'first.last@example.com',
				roles: [AuthorRole.Author, AuthorRole.Creator]
			});
		});
		test('Suggest Retrieval', () => {
			const sugg = getDescContent(ctx).suggests();
			assert.isDefined(sugg);
			assert.lengthOf(sugg, 6);
			assert.includeMembers(
				sugg?.map(n => n.name),
				['sf', 'tibble', 'testthat', 'svglite', 'xml2', 'vdiffr']
			);
		});
	});
	describe('Variant B', () => {
		const ctx = contextWithFile(DescriptionB);
		test('Library-Versions-Plugin', () => {
			const deps = ctx.deps.getDependencies();
			assert.lengthOf(deps, 5);
			assert.includeMembers(deps.map(n => n.name), ['methods', 'utils', 'ggplot2', 'rlang', 'R']);
			const rDep = ctx.deps.getDependency('R');
			assert.isDefined(rDep);
			assert.isTrue(rDep?.derivedVersion?.test('3.5.0'));
			assert.isFalse(rDep?.derivedVersion?.test('3.4.0'));
		});
		test('License parsing', () => {
			const license = getDescContent(ctx).license();
			assert.isDefined(license);
			assert.lengthOf(license, 1);
			const [first] = license;
			assert.deepStrictEqual(first, { type: 'license', license: 'GPL-3' });
		});
		test('Author retrieval', () => {
			const authors = getDescContent(ctx).authors();
			assert.isDefined(authors);
			assert.lengthOf(authors, 2);
			assert.deepStrictEqual(authors[0], {
				name:  ['Author', 'Surname'],
				roles: [AuthorRole.Author]
			});
			assert.deepStrictEqual(authors[1], {
				name:  ['Firstname', 'Lastname'],
				email: 'firstname.lastname@gmail.com',
				roles: [AuthorRole.Creator]
			});
		});
		test('Suggest Retrieval', () => {
			const sugg = getDescContent(ctx).suggests();
			assert.isDefined(sugg);
			assert.lengthOf(sugg, 4);
			assert.includeMembers(
				sugg?.map(n => n.name),
				['knitr', 'rmarkdown', 'testthat', 'covr']
			);
		});
	});
	describe('Variant B', () => {
		const ctx = contextWithFile(DescriptionB);
		test('Library-Versions-Plugin', () => {
			const deps = ctx.deps.getDependencies();
			assert.lengthOf(deps, 5);

			assert.includeMembers(deps.map(n => n.name), ['methods', 'utils', 'ggplot2', 'rlang', 'R']);
			const rDep = ctx.deps.getDependency('R');
			assert.isDefined(rDep);
			assert.isTrue(rDep?.derivedVersion?.test('3.5.0'));
			assert.isFalse(rDep?.derivedVersion?.test('3.4.0'));
		});
		test('License parsing', () => {
			const license = getDescContent(ctx).license();
			assert.isDefined(license);
			assert.lengthOf(license, 1);
			const [first] = license;
			assert.deepStrictEqual(first, { type: 'license', license: 'GPL-3' });
		});
		test('Author retrieval', () => {
			const authors = getDescContent(ctx).authors();
			assert.isDefined(authors);
			assert.lengthOf(authors, 2);
			assert.deepStrictEqual(authors[0], {
				name:  ['Author', 'Surname'],
				roles: [AuthorRole.Author]
			});
			assert.deepStrictEqual(authors[1], {
				name:  ['Firstname', 'Lastname'],
				email: 'firstname.lastname@gmail.com',
				roles: [AuthorRole.Creator]
			});
		});
	});
});