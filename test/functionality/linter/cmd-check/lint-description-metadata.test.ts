import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';

const Base: Readonly<Record<string, string>> = {
	Package:     'pkg',
	Version:     '1.0.2',
	Title:       'Tools for Data Analysis',
	Description: 'Provides tools to analyze data.',
	License:     'GPL-3',
	'Authors@R': 'person("Jane", "Doe", email = "jane@example.com", role = c("aut", "cre"))',
	Encoding:    'UTF-8'
};

/** a DESCRIPTION based on a valid one; `null` drops a field, a key that is no base field is appended */
function desc(over: Readonly<Record<string, string | null>> = {}): { DESCRIPTION: string } {
	const all = { ...Base, ...over };
	return { DESCRIPTION: Object.entries(all).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n' };
}

const D = '/pkg/DESCRIPTION';
const E = String.fromCharCode(233);

describe('flowR linter', withTreeSitter(parser => {
	describe('description-metadata', () => {
		const lint = (name: string, over: Readonly<Record<string, string | null>>, expected: Record<string, unknown>[], config: Record<string, unknown> = {}) =>
			assertLinterPackage(name, parser, 'x <- 1', 'description-metadata', expected, { files: desc(over), ...config });

		describe('no findings', () => {
			lint('valid DESCRIPTION', {}, []);
			assertLinterPackage('no DESCRIPTION, no results', parser, 'x <- 1', 'description-metadata', [], { files: { DESCRIPTION: null } });
			lint('Author and Maintainer instead of Authors@R', { 'Authors@R': null, Author: 'Jane Doe', Maintainer: 'Jane Doe <jane@example.com>' }, []);
			lint('dependencies with versions', { Depends: 'R (>= 3.5.0), methods', Imports: 'stats (>= 3.0), utils', Suggests: 'testthat', LinkingTo: 'Rcpp' }, [], { files: { ...desc({ Depends: 'R (>= 3.5.0), methods', Imports: 'stats (>= 3.0), utils', Suggests: 'testthat', LinkingTo: 'Rcpp' }), 'src/a.c': '' } });
			lint('multi-line fields', { Description: 'Provides tools\n    to analyze data.', Imports: 'stats,\n    utils' }, []);
		});

		describe('required fields', () => {
			lint('missing License', { License: null }, [{ kind: 'missing-field', message: "Required field missing or empty: 'License'", loc: [1, 1, 1, 1, D] }]);
			lint('missing Title and Description', { Title: null, Description: null }, [{ kind: 'missing-field', message: "Required field missing or empty: 'Description'" }, { kind: 'missing-field', message: "Required field missing or empty: 'Title'" }]);
			lint('empty Version', { Version: '' }, [{ kind: 'missing-field', message: "Required field missing or empty: 'Version'" }]);
			lint('missing Package', { Package: null }, [{ kind: 'missing-field', message: "Required field missing or empty: 'Package'" }]);
			lint('missing Author and Maintainer without Authors@R', { 'Authors@R': null }, [{ kind: 'missing-field', message: "Required field missing or empty: 'Author'" }, { kind: 'missing-field', message: "Required field missing or empty: 'Maintainer'" }]);
		});

		describe('package name, version, maintainer', () => {
			lint('malformed package name', { Package: '1abc' }, [{ kind: 'bad-package-name', message: 'Malformed package name', loc: [1, 1, 1, 13, D] }]);
			lint('trailing dot in package name', { Package: 'abc.' }, [{ kind: 'bad-package-name' }]);
			lint('name of a base package', { Package: 'stats' }, [{ kind: 'bad-package-name', message: 'Invalid package name. This is the name of a base package.' }]);
			lint('base package with base priority', { Package: 'stats', Priority: 'base' }, []);
			lint('malformed version', { Version: '1' }, [{ kind: 'bad-version', message: 'Malformed package version.', loc: [2, 1, 2, 10, D] }]);
			lint('malformed version with letters', { Version: '1.0-beta' }, [{ kind: 'bad-version' }]);
			lint('version with dash', { Version: '1.0-3' }, []);
			lint('malformed maintainer', { 'Authors@R': null, Author: 'Jane Doe', Maintainer: 'Jane Doe' }, [{ kind: 'bad-maintainer', message: 'Malformed maintainer field.' }]);
		});

		describe('dependency fields', () => {
			lint('bad entry', { Imports: 'stats, foo bar' }, [{ kind: 'bad-dependency', field: 'Imports', loc: [8, 1, 8, 23, D] }]);
			lint('empty entry in the middle', { Imports: 'stats,, utils' }, [{ kind: 'bad-dependency' }]);
			lint('trailing comma is fine', { Imports: 'stats,' }, []);
			lint('infeasible operator', { Depends: 'foo (~> 1.0)' }, [{ kind: 'bad-dependency', message: "Malformed Depends field. Entry with infeasible comparison operator: 'foo (~> 1.0)'. Only operators '<=' and '>=' are possible." }]);
			lint('infeasible version', { Suggests: 'foo (>= 1)' }, [{ kind: 'bad-dependency', field: 'Suggests' }]);
			lint('infeasible R version', { Depends: 'R (>= x)' }, [{ kind: 'bad-dependency' }]);
			lint('R revision version is fine', { Depends: 'R (>= r12345)' }, []);
			lint('missing space before the version', { Enhances: 'foo (>=1.0)' }, [{ kind: 'bad-dependency' }]);
			lint('LinkingTo is checked as well', { LinkingTo: 'Rcpp (>= 1)' }, [{ kind: 'bad-dependency', field: 'LinkingTo' }], { files: { ...desc({ LinkingTo: 'Rcpp (>= 1)' }), 'src/a.c': '' } });
			lint('invalid VignetteBuilder', { VignetteBuilder: 'knitr (>= 1.0)' }, [{ kind: 'bad-vignette-builder', field: 'VignetteBuilder' }]);
			lint('valid VignetteBuilder', { VignetteBuilder: 'knitr, rmarkdown' }, []);
		});

		describe('Title and Description endings', () => {
			lint('Title ending in a period', { Title: 'Tools for Data Analysis.' }, [{ kind: 'title-period', message: 'Malformed Title field: should not end in a period.' }]);
			lint('Title ending in et al.', { Title: 'Methods of Doe et al.' }, []);
			lint('Description without complete sentence', { Description: 'Tools to analyze data' }, [{ kind: 'description-sentence' }]);
			lint('Description ending in a quoted sentence', { Description: 'Provides tools to analyze "data."' }, []);
			lint('Description ending in a question mark', { Description: 'Provides tools. Why not?' }, []);
		});

		describe('encoding and non-ASCII values', () => {
			lint('non-ASCII without Encoding', { Encoding: null, Description: `Provides caf${E} tools.` }, [{ kind: 'unknown-encoding', field: 'Description', loc: [4, 1, 4, 33, D] }]);
			lint('non-ASCII with Encoding', { Description: `Provides caf${E} tools.` }, []);
			lint('non-portable encoding', { Encoding: 'cp1252' }, [{ kind: 'non-portable-encoding', message: "Encoding 'cp1252' is not portable" }]);
			lint('latin1 encoding is portable', { Encoding: 'latin1' }, []);
			lint('non-ASCII in an ASCII-only field', { Suggests: `f${E}r` }, [{ kind: 'non-ascii-value', field: 'Suggests' }]);
			lint('non-ASCII tag', { [`F${E}r`]: 'x' }, [{ kind: 'non-ascii-tag' }]);
		});

		describe('dependency hygiene', () => {
			lint('listed in more than one field', { Imports: 'stats, jsonlite', Suggests: 'jsonlite' }, [{ kind: 'duplicate-dependency', message: "Package 'jsonlite' listed in more than one of Depends, Imports, Suggests, Enhances. A package should be listed in only one of these fields.", field: 'Suggests' }]);
			lint('same package twice in a field', { Imports: 'jsonlite, jsonlite' }, []);
			lint('LinkingTo and Imports may overlap', { Imports: 'Rcpp', LinkingTo: 'Rcpp' }, [], { files: { ...desc({ Imports: 'Rcpp', LinkingTo: 'Rcpp' }), 'src/a.cpp': '' } });
			lint('package depending on itself', { Imports: 'pkg' }, [{ kind: 'self-dependency', field: 'Imports' }]);
			lint('many Depends', { Depends: 'R (>= 3.5), a1, a2, a3, a4, a5, a6, methods' }, [{ kind: 'many-depends', field: 'Depends' }]);
			lint('five non-default Depends are fine', { Depends: 'R (>= 3.5), a1, a2, a3, a4, a5, methods' }, []);
			lint('attached base packages are default Depends', { Depends: 'stats, graphics, grDevices, utils, datasets, methods, a1, a2' }, []);
			lint('non-attached base packages count as Depends', { Depends: 'grid, tools, splines, parallel, compiler, tcltk' }, [{ kind: 'many-depends' }]);
			lint('all base packages are excluded from maxImports', { Imports: 'grid, tools, splines, a1' }, [], { maxImports: 1 });
			lint('name of a base package outside of the attached ones', { Package: 'grid' }, [{ kind: 'bad-package-name', message: 'Invalid package name. This is the name of a base package.' }]);
			lint('maxDepends configured', { Depends: 'a1, a2' }, [{ kind: 'many-depends' }], { maxDepends: 1 });
			lint('Imports are not limited by default', { Imports: 'a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22' }, []);
			lint('maxImports configured', { Imports: 'a1, a2, a3, stats' }, [{ kind: 'many-imports', message: 'Imports includes 3 non-default packages. Importing from so many packages makes the package vulnerable to any of them becoming unavailable. Move as many as possible to Suggests and use conditionally.' }], { maxImports: 2 });
			lint('LinkingTo with a known src folder', { LinkingTo: 'Rcpp' }, [], { files: { ...desc({ LinkingTo: 'Rcpp' }), 'src/code.cpp': '' } });
			lint('LinkingTo without src, undecidable for a virtual project', { LinkingTo: 'Rcpp' }, []);
		});

		describe('license', () => {
			lint('non-standard license', { License: 'Free for all' }, [{ kind: 'license', message: "Non-standard license specification: 'Free for all'. Standardizable: no", field: 'License' }]);
			lint('standardizable license', { License: 'GPL version 2 or newer' }, []);
			lint('versioned license', { License: 'GPL (>= 2)' }, []);
			lint('license alternatives', { License: 'GPL-2 | GPL-3' }, []);
			lint('invalid license file pointer', { License: 'GPL-3 + file LICENSE' }, [{ kind: 'license', message: 'Invalid license file pointers: LICENSE' }]);
			lint('valid license file pointer', { License: 'GPL-3 + file LICENSE' }, [], { files: { ...desc({ License: 'GPL-3 + file LICENSE' }), LICENSE: 'text' } });
			lint('template license needs a file', { License: 'MIT' }, [{ kind: 'license', message: "License components which are templates and need '+ file LICENSE': MIT" }]);
			lint('template license with file', { License: 'MIT + file LICENSE' }, [], { files: { ...desc({ License: 'MIT + file LICENSE' }), LICENSE: 'YEAR: 2024' } });
			lint('deprecated license', { License: 'BSD' }, [{ kind: 'license', message: 'Non-standard license specification: \'BSD\'. Standardizable: no' }, { kind: 'license', message: 'Deprecated license: BSD' }]);
		});

		describe('Authors@R', () => {
			lint('no maintainer', { 'Authors@R': 'person("Jane", "Doe", role = "aut")' }, [{ kind: 'no-maintainer', message: 'Authors@R field gives no person with maintainer role, valid email address and non-empty name.' }]);
			lint('maintainer without email', { 'Authors@R': 'person("Jane", "Doe", role = c("aut", "cre"))' }, [{ kind: 'no-maintainer' }]);
			lint('two maintainers', { 'Authors@R': 'c(person("Jane", "Doe", email = "j@d.org", role = c("aut", "cre")), person("Joe", "Roe", email = "j@r.org", role = "cre"))' }, [{ kind: 'no-maintainer', message: 'Authors@R field gives more than one person with maintainer role.' }]);
			lint('no author role', { 'Authors@R': 'person("Jane", "Doe", email = "jane@example.com", role = "cre")' }, [{ kind: 'no-author', message: 'Authors@R field gives no person with name and author role' }]);
			lint('no author role, cranIncoming disabled', { 'Authors@R': 'person("Jane", "Doe", email = "jane@example.com", role = "cre")' }, [], { cranIncoming: false });
			lint('person without roles', { 'Authors@R': 'person("Jane", "Doe")' }, [{ kind: 'bad-authors-at-r', message: 'Authors@R field gives no person with name and roles.' }]);
			lint('malformed Authors@R', { 'Authors@R': 'Jane Doe' }, [{ kind: 'bad-authors-at-r', field: 'Authors@R' }]);
			lint('unbalanced Authors@R', { 'Authors@R': 'person("Jane", "Doe"' }, [{ kind: 'bad-authors-at-r' }]);
			lint('parenthesis in a string of Authors@R', { 'Authors@R': 'person("Jane", "Doe", email = "jane@example.com", role = c("aut", "cre"), comment = "smile :)")' }, []);
			lint('quote and parenthesis in a string of Authors@R', { 'Authors@R': "person('Jane', 'Doe', email = 'jane@example.com', role = c('aut', 'cre'), comment = \"(it's\")" }, []);
			lint('unbalanced Authors@R with a string', { 'Authors@R': 'person("Jane (", "Doe"' }, [{ kind: 'bad-authors-at-r' }]);
			lint('Authors@R is not checked with Author and Maintainer', { 'Authors@R': 'person("Jane", "Doe")', Author: 'Jane Doe', Maintainer: 'Jane Doe <jane@example.com>' }, []);
			lint('Authors@R is checked with Maintainer missing', { 'Authors@R': 'person("Jane", "Doe")', Author: 'Jane Doe' }, [{ kind: 'bad-authors-at-r' }]);
			lint('Authors@R over several lines', { 'Authors@R': 'c(person("Jane", "Doe", email = "j@d.org", role = c("aut", "cre")),\n    person("Joe", "Roe", role = "ctb"))' }, []);
		});

		describe('CRAN incoming style checks', () => {
			lint('Title not in title case', { Title: 'tools for data analysis' }, [{ kind: 'title-case', message: "The Title field should be in title case. Current version is: 'tools for data analysis' In title case that is: 'Tools for Data Analysis'" }]);
			lint('Title case with hyphen and colon', { Title: 'Fast and Easy-to-Use Tools: a Guide' }, []);
			lint('Title case misses a hyphenated word', { Title: 'Fast and Easy-to-use Tools' }, [{ kind: 'title-case' }]);
			lint('quoted words are left alone', { Title: "Analysis of 'ggplot2' and 'shiny' Objects" }, []);
			lint('title case disabled by cranIncoming', { Title: 'tools for data analysis' }, [], { cranIncoming: false });
			lint('title case only for English', { Title: 'tools for data analysis', Language: 'de' }, []);
			lint('Title is the package name', { Title: 'PKG' }, [{ kind: 'title-is-name', message: 'The Title field is just the package name: provide a real title.' }]);
			lint('Title starts with the package name', { Title: 'pkg: Tools for Data' }, [{ kind: 'title-starts-with-name', field: 'Title' }, { kind: 'title-case', field: 'Title' }]);
			lint('Title starts with A package', { Title: 'A Package for Data' }, [{ kind: 'title-starts-with-name' }]);
			lint('long Titles are no finding', { Title: 'Tools for the Analysis of Many Different Kinds of Data from Diverse Sources' }, []);
			lint('Description starting with This package', { Description: 'This package provides tools to analyze data.' }, [{ kind: 'description-start', message: "The Description field should not start with the package name, 'This package' or similar." }]);
			lint('Description starting with the package name', { Description: 'Pkg provides tools to analyze data.' }, [{ kind: 'description-start' }]);
			lint('Description starting with Functions for', { Description: 'Functions for analyzing data.' }, [{ kind: 'description-start' }]);
			lint('Description starting lowercase', { Description: 'provides tools to analyze data.' }, [{ kind: 'description-initial', message: 'The Description field should start with a capital letter.' }]);
			lint('Description start disabled by cranIncoming', { Description: 'This package provides tools.' }, [], { cranIncoming: false });
		});

		describe('locations', () => {
			lint('multi-line field spans its lines', { Imports: 'stats,\n    foo bar' }, [{ kind: 'bad-dependency', loc: [8, 1, 9, 11, D] }]);
			lint('field after a multi-line field', { Description: 'Provides tools\n    to analyze data', License: 'MIT' }, [{ kind: 'description-sentence', loc: [4, 1, 5, 19, D] }, { kind: 'license', loc: [6, 1, 6, 12, D] }]);
		});
	});
}));
