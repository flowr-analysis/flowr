import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('rd-files', () => {
		const rule = 'rd-files';
		const code = 'x <- 1';
		/** a valid page with the given extra sections */
		const rd = (extra = '', head = '\\name{f}\n\\alias{f}\n\\title{F}\n\\description{D}\n') => ({ 'man/f.Rd': head + extra });
		const kinds = (name: string, files: Record<string, string>, expected: string[], config = {}) =>
			assertLinterPackage(name, parser, code, rule, expected.map(kind => ({ kind })), { files, ...config });

		describe('checking Rd files', () => {
			kinds('a valid page', rd('\\usage{f(x)}\n\\arguments{\\item{x}{an x}}\n\\value{v}\n\\examples{f(1)}\n'), []);
			kinds('unbalanced braces', rd('\\details{some {text}\n'), ['rd-syntax']);
			assertLinterPackage('unbalanced braces: message and line', parser, code, rule, [
				{ kind: 'rd-syntax', loc: [5, 1, 5, 1, '/pkg/man/f.Rd'], message: 'f.Rd:5: unexpected END_OF_INPUT (the \'{\' on line 5 is never closed)' }
			], { files: rd('\\details{text\n') });
			kinds('stray closing brace', rd('\\details{text}}\n'), ['rd-syntax']);
			kinds('unterminated string in code', rd('\\examples{x <- "a\n}\n'), ['rd-syntax']);
			kinds('percent in a string is a comment', rd('\\examples{x <- "50%"}\n'), ['rd-syntax']);
			kinds('backslash escapes in an R comment', rd('\\examples{# paste("a", "\\n")\nf(1)\n}\n'), []);
			kinds('apostrophe in an R comment', rd('\\examples{x # don\'t\n}\n'), []);
			kinds('braces in a string of the examples', rd('\\examples{x <- "{"}\n'), []);
			kinds('unbalanced brace in dontrun', rd('\\examples{\\dontrun{f("{")}}\n'), ['rd-syntax']);
			assertLinterPackage('unknown macro', parser, code, rule, [
				{ kind: 'rd-unknown-macro', loc: [6, 1, 6, 1, '/pkg/man/f.Rd'], message: 'f.Rd:6: unknown macro \'\\foo\'' }
			], { files: rd('\\details{\n  a \\foo{x}}\n') });
			kinds('unknown macro in code', rd('\\details{\\code{\\n}}\n'), ['rd-unknown-macro', 'rd-empty-section']);
			kinds('macro defined in the page', rd('\\newcommand{\\foo}{bar}\n\\details{a \\foo}\n'), []);
			kinds('macro with arguments defined in man/macros', { ...rd('\\details{\\wrap{x}}\n'), 'man/macros/m.Rd': '\\newcommand{\\wrap}{[#1]}\n' }, []);
			kinds('macro of an Rd macro package', { ...rd('\\details{\\insertRef{k}{pkg}}\n'), DESCRIPTION: 'Package: pkg\nVersion: 1.0\nTitle: T\nLicense: MIT\nRdMacros: Rdpack\n' }, []);
			kinds('configured extra macro', rd('\\details{\\wrap}\n'), [], { extraMacros: ['\\wrap'] });
			kinds('system macros are known', rd('\\details{\\CRANpkg{x} \\doi{10.1/x} \\sspace}\n'), []);
			kinds('missing name', { 'man/f.Rd': '\\alias{f}\n\\title{F}\n\\description{D}\n' }, ['rd-structure']);
			kinds('missing title', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\description{D}\n' }, ['rd-structure']);
			kinds('repeated name', { 'man/f.Rd': '\\name{f}\n\\name{g}\n\\alias{f}\n\\title{F}\n\\description{D}\n' }, ['rd-structure']);
			kinds('name with markup', { 'man/f.Rd': '\\name{\\code{f}}\n\\alias{f}\n\\title{F}\n\\description{D}\n' }, ['rd-structure']);
			assertLinterPackage('repeated unique section', parser, code, rule, [
				{ kind: 'rd-structure', loc: [5, 1, 5, 1, '/pkg/man/f.Rd'], message: 'f.Rd:5: Only one \\description section is allowed: the first will be used' }
			], { files: rd('\\description{E}\n') });
			kinds('repeated alias is fine within a page', rd('\\alias{g}\n\\alias{h}\n'), []);
			kinds('text outside of a section', rd('stray text\n'), ['rd-structure']);
			kinds('inline macro at the top level', rd('\\code{x}\n'), ['rd-structure']);
			kinds('unrecognized docType', rd('\\docType{foo}\n'), ['rd-structure']);
			kinds('known docType', rd('\\docType{data}\n'), []);
			kinds('empty section is dropped', rd('\\details{ }\n'), ['rd-empty-section']);
			kinds('empty title', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{}\n\\description{D}\n' }, ['rd-empty-section']);
			kinds('only a method macro is empty text', rd('\\details{\\method{a}{b}}\n'), ['rd-markup', 'rd-empty-section']);
			kinds('non-ASCII without encoding', rd('\\details{caf\u00e9}\n'), ['rd-encoding']);
			kinds('non-ASCII with an \\encoding section', rd('\\encoding{UTF-8}\n\\details{caf\u00e9}\n'), []);
			kinds('non-ASCII with the DESCRIPTION encoding', { ...rd('\\details{caf\u00e9}\n'), DESCRIPTION: 'Package: pkg\nVersion: 1.0\nTitle: T\nLicense: MIT\nEncoding: UTF-8\n' }, []);
			kinds('non-ASCII in the second part of \\enc', { ...rd('\\details{\\enc{caf\u00e9}{caf\u00e9}}\n'), DESCRIPTION: 'Package: pkg\nVersion: 1.0\nTitle: T\nLicense: MIT\nEncoding: UTF-8\n' }, ['rd-encoding']);
			kinds('non-ASCII in a comment is ignored', rd('% caf\u00e9\n'), []);
			kinds('escaped LaTeX special', rd('\\details{a \\_ b}\n'), ['rd-markup']);
			kinds('escaped backslash before an underscore', rd('\\details{a \\\\_ b}\n'), []);
			kinds('title ending in a period is below the level R CMD check reports', rd('', '\\name{f}\n\\alias{f}\n\\title{F.}\n\\description{D}\n'), []);
			kinds('title ending in a period, all levels', rd('', '\\name{f}\n\\alias{f}\n\\title{F.}\n\\description{D}\n'), ['rd-markup'], { minLevel: -10 });
			kinds('title ending in etc.', rd('', '\\name{f}\n\\alias{f}\n\\title{F etc.}\n\\description{D}\n'), [], { minLevel: -10 });
			kinds('tag only valid in usage', rd('\\details{\\code{\\method{a}{b}}}\n'), ['rd-markup', 'rd-empty-section']);
			kinds('dontrun outside of examples', rd('\\details{\\dontrun{x}}\n'), ['rd-markup', 'rd-empty-section']);
			kinds('wrong tag in a code block', rd('\\details{\\code{\\emph{x}}}\n'), ['rd-markup']);
			kinds('\\method in usage', rd('\\usage{\\method{print}{foo}(x)}\n'), []);
			kinds('too many table columns', rd('\\details{\\tabular{ll}{a \\tab b \\tab c}}\n'), ['rd-markup']);
			kinds('too few table columns are below the level', rd('\\details{\\tabular{lll}{a \\tab b}}\n'), []);
			kinds('table format', rd('\\details{\\tabular{lx}{a \\tab b}}\n'), ['rd-markup']);
			kinds('valid table', rd('\\details{\\tabular{ll}{a \\tab b \\cr c \\tab d \\cr}}\n'), []);
			kinds('unrecognized \\if format', rd('\\details{\\if{pdf}{a}}\n'), ['rd-markup']);
			kinds('macro as argument label', rd('\\arguments{\\item{\\dots}{x}\\item{\\code{}}{y}}\n'), []);
			kinds('escaped percent in the name', { 'man/pipe.Rd': '\\name{\\%>\\%}\n\\alias{\\%>\\%}\n\\title{Pipe}\n\\description{D}\n' }, []);
			kinds('empty argument label', rd('\\arguments{\\item{}{x}}\n'), ['rd-markup']);
			kinds('lost braces', rd('\\details{d {x}}\n'), ['rd-lost-braces']);
			kinds('braces holding a macro are no lost braces', rd('\\details{d\n\n{\\bold{x}}}\n'), []);
			kinds('invalid email', rd('\\details{\\email{nobody}}\n'), ['rd-markup']);
			kinds('valid email', rd('\\details{\\email{a@b.org}}\n'), []);
			kinds('unknown URL scheme', rd('\\details{\\url{foo://x}}\n'), ['rd-markup']);
			kinds('known URL scheme', rd('\\details{\\url{https://x.org/a}}\n'), []);
			kinds('page-level pdf: figure size in percent', rd('\\details{\\figure{a.png}{options: width=50\\%}}\n'), []);
			kinds('bibentry cited, not shown', rd('\\details{\\bibcitep{key}}\n'), ['rd-bibentry']);
			kinds('bibentry shown', rd('\\details{\\bibcitep{key}\n\\bibshow{*}}\n'), []);
		});

		describe('checking Rd metadata', () => {
			kinds('duplicated name', { ...rd(), 'man/g.Rd': '\\name{f}\n\\alias{g}\n\\title{G}\n\\description{D}\n' }, ['rd-duplicate-name']);
			kinds('duplicated alias', { ...rd(), 'man/g.Rd': '\\name{g}\n\\alias{f}\n\\title{G}\n\\description{D}\n' }, ['rd-duplicate-alias']);
			assertLinterPackage('duplicated alias: message', parser, code, rule, [
				{ kind: 'rd-duplicate-alias', file: 'man/g.Rd', message: 'Rd files with duplicated alias \'f\': f.Rd, g.Rd' }
			], { files: { ...rd(), 'man/g.Rd': '\\name{g}\n\\alias{f}\n\\title{G}\n\\description{D}\n' } });
			kinds('page without alias', { 'man/f.Rd': '\\name{f}\n\\title{F}\n\\description{D}\n' }, ['rd-missing-alias']);
			kinds('names differing only by case', { ...rd(), 'man/g.Rd': '\\name{F}\n\\alias{F}\n\\title{G}\n\\description{D}\n' }, ['rd-name-case', 'rd-name-case']);
			kinds('own package alias', { 'man/pkg-package.Rd': '\\name{pkg-package}\n\\alias{pkg-package}\n\\title{T}\n\\description{D}\n\\docType{package}\n' }, []);
			kinds('foreign package alias', { 'man/o-package.Rd': '\\name{o-package}\n\\alias{o-package}\n\\title{T}\n\\description{D}\n' }, ['rd-package-alias']);
			kinds('package alias differing by case from the own one', { 'man/p.Rd': '\\name{p}\n\\alias{pkg-package}\n\\alias{Pkg-package}\n\\title{T}\n\\description{D}\n' }, []);
			kinds('metadata off', { ...rd(), 'man/g.Rd': '\\name{f}\n\\alias{g}\n\\title{G}\n\\description{D}\n' }, [], { metadata: false });
		});

		describe('checking Rd cross-references', () => {
			kinds('link to an alias of the package', { ...rd('\\seealso{\\link{g}}\n'), 'man/g.Rd': '\\name{g}\n\\alias{g}\n\\title{G}\n\\description{D}\n' }, []);
			kinds('link to a base function', rd('\\seealso{\\link{lm}}\n'), []);
			kinds('link to an undeclared package', rd('\\seealso{\\link[dplyr]{filter}}\n'), ['rd-undeclared-package']);
			kinds('link to a base package', rd('\\seealso{\\link[stats]{lm}}\n'), []);
			kinds('link to a suggested package', { ...rd('\\seealso{\\link[dplyr]{filter}}\n'), DESCRIPTION: 'Package: pkg\nVersion: 1.0\nTitle: T\nLicense: MIT\nSuggests: dplyr\n' }, []);
			kinds('link to an enhanced package', { ...rd('\\seealso{\\link[dplyr]{filter}}\n'), DESCRIPTION: 'Package: pkg\nVersion: 1.0\nTitle: T\nLicense: MIT\nEnhances: dplyr\n' }, []);
			kinds('undeclared package reported once', rd('\\seealso{\\link[dplyr]{filter} \\link[dplyr]{mutate}}\n'), ['rd-undeclared-package']);
			kinds('link into the own package', rd('\\seealso{\\link[pkg]{f}}\n'), []);
			kinds('cross-references off', rd('\\seealso{\\link[dplyr]{filter}}\n'), [], { crossReferences: false });
			kinds('link to a base function in the wrong base package', rd('\\seealso{\\link[base]{lm}}\n'), ['rd-missing-link']);
			assertLinterPackage('wrong base package: certainty', parser, code, rule, [
				{ kind: 'rd-missing-link', certainty: LintingResultCertainty.Uncertain }
			], { files: rd('\\seealso{\\link[base]{lm}}\n') });
			kinds('uncertain links off', rd('\\seealso{\\link[base]{lm}}\n'), [], { uncertainLinks: false });
		});

		describe('checking Rd line widths', () => {
			const wide = (n: number) => `f(x = ${'a'.repeat(n - 7)})`;
			kinds('usage line of the allowed width', rd(`\\usage{\n${wide(90)}\n}\n`), []);
			assertLinterPackage('usage line too wide', parser, code, rule, [
				{ kind: 'rd-line-width', loc: [6, 1, 6, 1, '/pkg/man/f.Rd'] }
			], { files: rd(`\\usage{\n${wide(91)}\n}\n`) });
			kinds('examples line of the allowed width', rd(`\\examples{\n${wide(100)}\n}\n`), []);
			kinds('examples line too wide', rd(`\\examples{\n${wide(101)}\n}\n`), ['rd-line-width']);
			kinds('escapes are counted as rendered', rd(`\\usage{\n${wide(90)}\\%\\%\n}\n`), ['rd-line-width']);
			kinds('configured widths', rd(`\\usage{\n${wide(60)}\n}\n`), ['rd-line-width'], { usageWidth: 50 });
			kinds('line widths off', rd(`\\usage{\n${wide(200)}\n}\n`), [], { lineWidths: false });
		});

		describe('checking Rd contents', () => {
			kinds('missing description', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{F}\n' }, ['rd-missing-description']);
			kinds('package pages need no description', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{F}\n\\docType{package}\n' }, []);
			kinds('argument without text', rd('\\arguments{\\item{x}{}\n\\item{y}{why}}\n'), ['rd-undocumented-argument']);
			kinds('internal pages need no argument text', rd('\\arguments{\\item{x}{}}\n\\keyword{internal}\n'), []);
			kinds('prompt() title', rd('', '\\name{f}\n\\alias{f}\n\\title{A Capitalized Title}\n\\description{D}\n'), ['rd-boilerplate']);
			kinds('prompt() argument', rd('\\arguments{\\item{x}{~~Describe \\code{x} here~~}}\n'), ['rd-boilerplate']);
			kinds('prompt() keyword', rd('\\keyword{~kwd1}\n'), ['rd-boilerplate']);
			kinds('prompt() details in a comment is ignored', rd('% \\details{If necessary, more details than the description above}\n'), []);
			kinds('prompt() examples', rd('\\examples{\n## Optional simple examples of the most important functions\n}\n'), ['rd-boilerplate']);
			kinds('missing value is not reported by default', rd('\\usage{f(x)}\n'), []);
			kinds('missing value, if required', rd('\\usage{f(x)}\n'), ['rd-missing-value'], { requireValue: true });
			kinds('value present', rd('\\usage{f(x)}\n\\value{v}\n'), [], { requireValue: true });
			kinds('data pages need no value', rd('\\docType{data}\n\\usage{f}\n'), [], { requireValue: true });
			kinds('nonstandard keywords are not reported by default', rd('\\keyword{mine}\n'), []);
			kinds('nonstandard keyword', rd('\\keyword{mine}\n'), ['rd-keyword'], { standardKeywords: true });
			kinds('standard keyword', rd('\\keyword{datasets}\n'), [], { standardKeywords: true });
			kinds('configured keywords', rd('\\keyword{mine}\n'), [], { standardKeywords: true, keywords: ['mine'] });
			kinds('contents off', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{F}\n' }, [], { contents: false });
			const ns = 'S3method(print, foo)\n';
			kinds('S3 method shown with its full name', { ...rd('\\usage{print.foo(x)}\n'), NAMESPACE: ns }, ['rd-s3-method-name']);
			kinds('S3 method with \\method', { ...rd('\\usage{\\method{print}{foo}(x)}\n'), NAMESPACE: ns }, []);
			kinds('function that is no S3 method', { ...rd('\\usage{print.bar(x)}\n'), NAMESPACE: ns }, []);
			kinds('doc style off', { ...rd('\\usage{print.foo(x)}\n'), NAMESPACE: ns }, [], { docStyle: false });
		});

		describe('checking examples', () => {
			kinds('examples that parse', rd('\\examples{f(1)\nx <- 2}\n'), []);
			assertLinterPackage('examples that do not parse', parser, code, rule, [
				{ kind: 'rd-example-syntax', loc: [7, 1, 7, 1, '/pkg/man/f.Rd'] }
			], { files: rd('\\examples{\nf(1)\nx <- (\n}\n') });
			kinds('code in dontrun is not parsed', rd('\\examples{\\dontrun{x <- (}}\n'), []);
			kinds('T in examples', rd('\\examples{f(x, flag = T)}\n'), ['rd-example-abbreviation']);
			kinds('F and T are both reported', rd('\\examples{f(T, F)}\n'), ['rd-example-abbreviation', 'rd-example-abbreviation']);
			kinds('argument named T', rd('\\examples{f(T = 1)}\n'), []);
			kinds('TRUE in examples', rd('\\examples{f(TRUE)}\n'), []);
			kinds('q() in examples', rd('\\examples{q()}\n'), ['rd-example-quit']);
			kinds('quit() in examples', rd('\\examples{quit("no")}\n'), ['rd-example-quit']);
			kinds('setwd() without restoring', rd('\\examples{setwd("..")}\n'), ['rd-example-setwd']);
			kinds('setwd() restored', rd('\\examples{old <- setwd("..")\nsetwd(old)}\n'), []);
			kinds('setwd() restored by on.exit', rd('\\examples{f <- function() {old <- setwd(".."); on.exit(setwd(old))}}\n'), []);
			kinds('write.csv to a literal path', rd('\\examples{write.csv(x, "out.csv")}\n'), ['rd-example-file']);
			kinds('write to a tempfile', rd('\\examples{write.csv(x, tempfile())}\n'), []);
			kinds('named file argument', rd('\\examples{saveRDS(x, file = "x.rds")}\n'), ['rd-example-file']);
			kinds('sink to a literal path', rd('\\examples{sink("log.txt")}\n'), ['rd-example-file']);
			kinds('cat to the console', rd('\\examples{cat("hi")}\n'), []);
			kinds('cat to a file', rd('\\examples{cat("hi", file = "x.txt")}\n'), ['rd-example-file']);
			kinds('examples off', rd('\\examples{q()}\n'), [], { examples: false });
			assertLinterPackage('example finding lines', parser, code, rule, [
				{ kind: 'rd-example-quit', loc: [7, 1, 7, 1, '/pkg/man/f.Rd'] }
			], { files: rd('\\examples{\nx <- 1\nq()\n}\n') });
		});

		describe('configuration and scope', () => {
			kinds('parsing off', rd('\\details{\\foo}\n'), [], { parse: false });
			kinds('no man folder', {}, []);
			kinds('page in an OS subfolder', { 'man/unix/f.Rd': '\\name{f}\n\\alias{f}\n\\title{F}\n\\description{D \\foo}\n' }, ['rd-unknown-macro']);
			kinds('macro files are no pages', { 'man/macros/m.Rd': '\\newcommand{\\a}{b}\n' }, []);
			kinds('files outside of man are ignored', { 'inst/other.Rd': '\\foo{' }, []);
			kinds('comments hide braces', rd('\\details{a % {\n}\n'), []);
		});
	});
}));
