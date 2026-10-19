import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('package-metafiles', () => {
		const rule = 'package-metafiles';
		const code = 'x <- 1';

		describe('index information', () => {
			assertLinterPackage('empty INDEX', parser, code, rule, [
				{ certainty: LintingResultCertainty.Certain, kind: 'empty-index', file: 'INDEX', message: 'Empty file \'INDEX\'.' }
			], { files: { INDEX: '' } });
			assertLinterPackage('non-empty INDEX', parser, code, rule, [], { files: { INDEX: 'pkg  A package\n' } });
			assertLinterPackage('demo folder without demo/00Index', parser, code, rule, [
				{ kind: 'empty-demo-index', file: 'demo/00Index', message: 'Empty or missing file \'demo/00Index\'.' }
			], { files: { 'demo/a.R': 'x' } });
			assertLinterPackage('empty demo/00Index', parser, code, rule, [{ kind: 'empty-demo-index', file: 'demo/00Index' }], {
				files: { 'demo/a.R': 'x', 'demo/00Index': '' }
			});
			assertLinterPackage('no demo folder needs no demo index', parser, code, rule, [], { files: { 'R/other.R': 'y <- 2' } });
			assertLinterPackage('demo missing from the index', parser, code, rule, [
				{ kind: 'undocumented-demo', file: 'demo/b.R', message: 'Demos with missing or empty index information: \'b\' (in \'demo/b.R\')' }
			], { files: { 'demo/a.R': 'x', 'demo/b.R': 'y', 'demo/00Index': 'a    A demo\n' } });
			assertLinterPackage('demo listed without a description', parser, code, rule, [
				{ kind: 'undocumented-demo', file: 'demo/a.R' }
			], { files: { 'demo/a.R': 'x', 'demo/b.R': 'y', 'demo/00Index': 'a\nb    B demo\n' } });
			assertLinterPackage('index entry without demo', parser, code, rule, [
				{ kind: 'missing-demo', file: 'demo/00Index', loc: [2, 1, 2, 1, '/pkg/demo/00Index'], message: 'Demo index entry without corresponding demo: \'ghost\'' }
			], { files: { 'demo/a.R': 'x', 'demo/00Index': 'a    A demo\nghost    G\n' } });
			assertLinterPackage('index entries without any demo', parser, code, rule, [
				{ kind: 'missing-demo', file: 'demo/00Index' }, { kind: 'missing-demo', file: 'demo/00Index' }
			], { files: { 'demo/00Index': 'a    A\nb    B\n' } });
			assertLinterPackage('continued description lines', parser, code, rule, [], {
				files: { 'demo/a.R': 'x', 'demo/00Index': 'a    A demo that\n    spans lines\n' }
			});
			assertLinterPackage('demo with a dot in its name', parser, code, rule, [], {
				files: { 'demo/my.demo.R': 'x', 'demo/00Index': 'my.demo    My demo\n' }
			});
			assertLinterPackage('lower-case demo extension', parser, code, rule, [], {
				files: { 'demo/b.r': 'x', 'demo/00Index': 'b    B\n' }
			});
			assertLinterPackage('demos in subfolders are no demos', parser, code, rule, [], {
				files: { 'demo/a.R': 'x', 'demo/sub/d.R': 'x', 'demo/00Index': 'a    A\n' }
			});
			assertLinterPackage('demos starting with a digit are no demos', parser, code, rule, [], {
				files: { 'demo/a.R': 'x', 'demo/1x.R': 'x', 'demo/00Index': 'a    A\n' }
			});
			assertLinterPackage('other file types are no demos', parser, code, rule, [], {
				files: { 'demo/a.R': 'x', 'demo/notes.txt': 'x', 'demo/00Index': 'a    A\n' }
			});
			assertLinterPackage('index checks disabled', parser, code, rule, [], { files: { INDEX: '' }, index: false });
		});

		describe('citation', () => {
			const withCitation = (content: string) => ({ files: { 'inst/CITATION': content } });

			assertLinterPackage('valid bibentry', parser, code, rule, [], withCitation('bibentry("Article", title = "x", author = "A", journal = "J", year = 2020)'));
			assertLinterPackage('syntax error', parser, code, rule, [
				{ kind: 'citation-syntax', file: 'inst/CITATION', loc: [1, 1, 1, 1, '/pkg/inst/CITATION'] }
			], withCitation('bibentry("Article", title = "x" author = "A")'));
			assertLinterPackage('syntax error on a later line', parser, code, rule, [
				{ kind: 'citation-syntax', file: 'inst/CITATION', loc: [2, 1, 2, 1, '/pkg/inst/CITATION'] }
			], withCitation('x <- 1\nbibentry("Article"'));
			assertLinterPackage('invalid entry type', parser, code, rule, [
				{ kind: 'citation-entry-type', file: 'inst/CITATION', message: 'entry 1: invalid type \'Foo\'' }
			], withCitation('bibentry("Foo", title = "x")'));
			assertLinterPackage('entry type that is no string', parser, code, rule, [
				{ kind: 'citation-entry-type', file: 'inst/CITATION', message: 'entry 1: invalid type \'type\'' }
			], withCitation('bibentry(type, title = "x")'));
			assertLinterPackage('entry type is case-insensitive', parser, code, rule, [], withCitation('bibentry("article", title = "x", author = "A", journal = "J", year = 2020)'));
			assertLinterPackage('missing required fields', parser, code, rule, [
				{ kind: 'citation-missing-field', file: 'inst/CITATION', loc: [1, 1, 1, 1, '/pkg/inst/CITATION'], message: 'entry 1 (Article): missing required field(s) \'journal\', \'year\'' }
			], withCitation('bibentry("Article", title = "x", author = "A")'));
			assertLinterPackage('alternative fields', parser, code, rule, [], withCitation('bibentry("Book", title = "x", editor = "E", publisher = "P", year = 1)'));
			assertLinterPackage('missing alternative field', parser, code, rule, [
				{ kind: 'citation-missing-field', file: 'inst/CITATION', message: 'entry 1 (Book): missing required field(s) \'author|editor\'' }
			], withCitation('bibentry("Book", title = "x", publisher = "P", year = 1)'));
			assertLinterPackage('type without required fields', parser, code, rule, [], withCitation('bibentry("Misc")'));
			assertLinterPackage('empty and NULL fields do not count', parser, code, rule, [
				{ kind: 'citation-missing-field', file: 'inst/CITATION', message: 'entry 1 (Article): missing required field(s) \'year\'' }
			], withCitation('bibentry("Article", title = "x", author = "A", journal = "J", year = NULL)'));
			assertLinterPackage('blank field does not count', parser, code, rule, [
				{ kind: 'citation-missing-field', file: 'inst/CITATION', message: 'entry 1 (Article): missing required field(s) \'year\'' }
			], withCitation('bibentry("Article", title = "x", author = "A", journal = "J", year = " ")'));
			assertLinterPackage('bibtype given by name', parser, code, rule, [], withCitation('bibentry(bibtype = "Misc", title = "x")'));
			assertLinterPackage('fields given in a list as other', parser, code, rule, [], withCitation('bibentry("Article", title = "x", author = "A", other = list(journal = "J", year = 2020))'));
			assertLinterPackage('citEntry is checked like bibentry', parser, code, rule, [
				{ kind: 'citation-superseded', file: 'inst/CITATION', message: 'citEntry() is superseded by bibentry(), use that instead' },
				{ kind: 'citation-missing-field', file: 'inst/CITATION', message: 'entry 1 (Article): missing required field(s) \'year\'' }
			], withCitation('citEntry(entry = "Article", title = "T", author = "A", journal = "J")'));
			assertLinterPackage('entries are numbered', parser, code, rule, [
				{ kind: 'citation-entry-type', file: 'inst/CITATION', message: 'entry 2: invalid type \'Foo\'' }
			], withCitation('bibentry("Misc")\nbibentry("Foo")'));
			assertLinterPackage('only top-level calls are checked as R does', parser, code, rule, [], withCitation('x <- bibentry("Foo")'));
			assertLinterPackage('citation checks disabled', parser, code, rule, [], { ...withCitation('bibentry("Foo")'), citation: false });
			assertLinterPackage('no inst/CITATION, nothing to check', parser, code, rule, [], { files: { 'docs/notes.md': 'x' } });
		});

		describe('citation location', () => {
			assertLinterPackage('CITATION file at the package root', parser, code, rule, [
				{ kind: 'citation-location', file: 'CITATION', message: 'Found the CITATION file in a non-standard place: \'CITATION\', most likely \'inst/CITATION\' should be used instead' }
			], { files: { CITATION: 'bibentry("Misc")' } });
			assertLinterPackage('CITATION with an extension in a subfolder', parser, code, rule, [
				{ kind: 'citation-location', file: 'docs/CITATION.R' }
			], { files: { 'docs/CITATION.R': 'bibentry("Misc")' } });
			assertLinterPackage('CITATION location disabled', parser, code, rule, [], { files: { CITATION: 'bibentry("Misc")' }, citation: false });
			assertLinterPackage('other names are no CITATION file', parser, code, rule, [], { files: { 'docs/CITATION.tar.gz': 'x', 'CITATIONS.md': 'x' } });
		});

		describe('superseded citation functions', () => {
			assertLinterPackage('citHeader is superseded', parser, code, rule, [
				{ kind: 'citation-superseded', file: 'inst/CITATION', loc: [1, 1, 1, 1, '/pkg/inst/CITATION'], message: 'citHeader() is superseded by bibentry(), use that instead' }
			], { files: { 'inst/CITATION': 'citHeader("Hdr")' } });
			assertLinterPackage('personList is superseded by person', parser, code, rule, [
				{ kind: 'citation-superseded', file: 'inst/CITATION', message: 'personList() is superseded by person(), use that instead' }
			], { files: { 'inst/CITATION': 'x <- personList(person("A"))' } });
			assertLinterPackage('superseded functions are reported without the other checks', parser, code, rule, [
				{ kind: 'citation-superseded', file: 'inst/CITATION' }
			], { files: { 'inst/CITATION': 'citFooter("Ftr")\nbibentry("Misc")' } });
			assertLinterPackage('superseded functions disabled', parser, code, rule, [], { files: { 'inst/CITATION': 'citHeader("Hdr")' }, superseded: false });
		});

		describe('relative links', () => {
			assertLinterPackage('link to a file of the package', parser, code, rule, [], {
				files: { 'README.md': 'See [the logo](man/figures/logo.png).', 'man/figures/logo.png': '' }
			});
			assertLinterPackage('link to a missing file', parser, code, rule, [
				{ kind: 'relative-link', file: 'README.md', loc: [3, 1, 3, 1, '/pkg/README.md'], message: 'Found the (possibly) invalid relative link \'docs/guide.md\' in \'README.md\', no such file in the package' }
			], { files: { 'README.md': '# Title\n\nSee [the guide](docs/guide.md).\n' } });
			assertLinterPackage('link with a title to a missing file', parser, code, rule, [
				{ kind: 'relative-link', file: 'README.md', message: 'Found the (possibly) invalid relative link \'missing.md\' in \'README.md\', no such file in the package' }
			], { files: { 'README.md': '[x](missing.md "a title")' } });
			assertLinterPackage('anchor of an existing file', parser, code, rule, [], { files: { 'README.md': '[x](NEWS.md#news)', 'NEWS.md': '# News' } });
			assertLinterPackage('query of a missing file', parser, code, rule, [
				{ kind: 'relative-link', file: 'README.md', message: 'Found the (possibly) invalid relative link \'gone.md?raw=1\' in \'README.md\', no such file in the package' }
			], { files: { 'README.md': '[x](gone.md?raw=1)' } });
			assertLinterPackage('URLs, anchors and mail addresses are no relative links', parser, code, rule, [], {
				files: { 'README.md': '[a](https://example.org) [b](#usage) [c](mailto:a@b.c) [d](/absolute/path) <a href="http://x.org">x</a>' }
			});
			assertLinterPackage('html attribute to a missing file', parser, code, rule, [
				{ kind: 'relative-link', file: 'README.md', message: 'Found the (possibly) invalid relative link \'man/x.png\' in \'README.md\', no such file in the package' }
			], { files: { 'README.md': '<img src="man/x.png">' } });
			assertLinterPackage('link out of the package', parser, code, rule, [
				{ kind: 'relative-link', file: 'README.md', message: 'Found the (possibly) invalid relative link \'../other.md\' in \'README.md\', no such file in the package' }
			], { files: { 'README.md': '[x](../other.md)' } });
			assertLinterPackage('link of a vignette is relative to the vignette', parser, code, rule, [], {
				files: { 'vignettes/intro.Rmd': '![fig](figs/a.png)', 'vignettes/figs/a.png': '' }
			});
			assertLinterPackage('vignette link to a missing file', parser, code, rule, [
				{ kind: 'relative-link', file: 'vignettes/intro.Rmd', message: 'Found the (possibly) invalid relative link \'a.png\' in \'vignettes/intro.Rmd\', no such file in the package' }
			], { files: { 'vignettes/intro.Rmd': '![fig](a.png)' } });
			assertLinterPackage('NEWS links are checked', parser, code, rule, [
				{ kind: 'relative-link', file: 'NEWS.md', message: 'Found the (possibly) invalid relative link \'doc/new.md\' in \'NEWS.md\', no such file in the package' }
			], { files: { 'NEWS.md': '# 1.1\n\n- see [here](doc/new.md)' } });
			assertLinterPackage('other markdown files are no package URLs', parser, code, rule, [], { files: { 'docs/notes.md': '[x](gone.md)' } });
			assertLinterPackage('relative links disabled', parser, code, rule, [], { files: { 'README.md': '[x](gone.md)' }, relativeLinks: false });
		});

		describe('no package', () => {
			assertLinterPackage('code without a package checks no metafiles', parser, code, rule, [], {
				files: { DESCRIPTION: null, INDEX: '' }
			});
		});
	});
}));
