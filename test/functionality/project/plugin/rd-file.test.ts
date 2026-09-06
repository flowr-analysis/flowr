import { assert, test } from 'vitest';
import { FlowrAnalyzerDataListFilePlugin, FlowrAnalyzerRdFilePlugin, FlowrAnalyzerRdMacroFilePlugin, FlowrAnalyzerRdMetaFilePlugin, FlowrAnalyzerRdTopicIndexFilePlugin } from '../../../../src/project/plugins/file-plugins/flowr-analyzer-rd-file-plugin';
import { expandRdMacros, parseAnIndex, parseDataList, parseRdMacros, parseRdPage, parseRdTopicIndex, type RdPage, RdIndex, RdMatch } from '../../../../src/project/plugins/file-plugins/files/flowr-rd-file';
import { testTopicOf } from './plugin-test-helper';

const PrintPage = `% a comment, and a literal 50\\% below
\\name{print}
\\alias{print}
\\alias{print.default}
\\alias{print,myclass-method}
\\alias{dim<-}
\\title{Print \\code{Values}}
\\docType{methods}
\\keyword{print}
\\keyword{internal}
\\usage{
print(x, ...)

\\method{print}{default}(x, digits = NULL, ...)
}
\\arguments{
  \\item{x, digits}{the object and the \\emph{digits} to use}
  \\item{...}{further arguments}
}
`;

/** The fields `parseRdPage(rd, fallback)` reports, checked against `expected`. */
function testPage(name: string, rd: string, expected: Partial<Pick<RdPage, 'name' | 'docType' | 'title' | 'keywords' | 'aliases' | 'usage'>> & { arguments?: readonly (readonly [string, string])[] }, fallback = 'fallback') {
	test(name, () => {
		const page = parseRdPage(rd, fallback);
		for(const key of ['name', 'docType', 'title', 'keywords', 'aliases', 'usage'] as const) {
			if(expected[key] !== undefined) {
				assert.deepEqual(page[key], expected[key], key);
			}
		}
		for(const [arg, description] of expected.arguments ?? []) {
			assert.strictEqual(page.arguments.get(arg), description, arg);
		}
	});
}

/** Whether `plugin.applies(path)` matches `expected`. */
function testApplies(name: string, plugin: { applies(path: string): boolean }, path: string, expected: boolean) {
	test(name, () => assert.strictEqual(plugin.applies(path), expected));
}
testPage('name, docType, title, keywords, aliases, usage and arguments', PrintPage, { name: 'print', docType: 'methods', title: 'Print Values', keywords: ['print', 'internal'], aliases: ['print', 'print.default', 'print,myclass-method', 'dim<-'], usage: ['print(x, ...)', 'print.default(x, digits = NULL, ...)'], arguments: [['x', 'the object and the digits to use'], ['digits', 'the object and the digits to use'], ['...', 'further arguments']] });
testPage('a page without a \\name{} falls back to the file name', '\\alias{foo}', { name: 'fallback' });
const PrintIndex = new RdIndex().add(parseRdPage(PrintPage)).add(parseRdPage('\\name{sum}\\alias{sum}'));
testTopicOf('the page itself answers to its own name', PrintIndex, 'print', { topic: 'print', via: RdMatch.Page });
testTopicOf('an alias answers to the page it belongs to', PrintIndex, 'print.default', { topic: 'print', via: RdMatch.Alias });
testTopicOf('an undocumented name answers nothing', PrintIndex, 'neverDocumented', undefined);
testTopicOf('an S4 method is found from its generic alias', PrintIndex, 'print,myclass-method', { topic: 'print', via: RdMatch.Alias });
/* only the `sum,cls-method` spelling is aliased anywhere, so the bare generic answers through it */
testTopicOf('an S4 generic is found from its method', new RdIndex().add(parseRdPage('\\name{Arith-methods}\\alias{sum,myclass-method}')), 'sum', { topic: 'Arith-methods', via: RdMatch.S4Method });
testTopicOf('a replacement shares its reader\'s page', new RdIndex().add(parseRdPage('\\name{dim}\\alias{dim}')), 'dim<-', { topic: 'dim', via: RdMatch.Replacement });
testTopicOf('an S3 method falls back to its generic, longest first', new RdIndex().add(parseRdPage('\\name{as.data.frame}\\alias{as.data.frame}')).add(parseRdPage('\\name{as.data}\\alias{as.data}')), 'as.data.frame.matrix', { topic: 'as.data.frame', via: RdMatch.S3Generic });
test('documents() answers the same, undocumented names as false', () => {
	assert.deepEqual([PrintIndex.documents('neverDocumented'), PrintIndex.documents('sum')], [false, true]);
});

test('an installed package\'s help/AnIndex reads the alias-to-topic pairs, and answers the same questions the pages do', () => {
	const anIndex = 'print\tprint\nprint.default\tprint\nsum\tArith-methods\nbroken line without a tab and more\n';
	assert.deepEqual(parseAnIndex(anIndex), [['print', 'print'], ['print.default', 'print'], ['sum', 'Arith-methods']]);
	const index = new RdIndex().addAliases(parseAnIndex(anIndex));
	assert.deepEqual(index.topicOf('print.default'), { topic: 'print', via: RdMatch.Alias });
	assert.isUndefined(index.page('print'), 'an AnIndex carries no page');
	assert.isFalse(index.empty);
});

test.each([
	['an alias that is itself a brace is the name, not a stray backslash', '\\name{Paren}\\alias{(}\\alias{\\{}\\alias{\\%in\\%}', (p: RdPage) => assert.deepEqual(p.aliases, ['(', '{', '%in%'])],
	['a comment runs to the end of its line, an escaped percent does not start one', '\\name{a}% dropped \\alias{never}\n\\alias{kept}\n\\title{100\\% sure}', (p: RdPage) => assert.deepEqual([p.aliases, p.title], [['kept'], '100% sure'])],
	['an even run of backslashes leaves the percent a comment', '\\name{a}\n\\keyword{k}\\\\% \\keyword{dropped}', (p: RdPage) => assert.deepEqual(p.keywords, ['k'])],
	['markup macros are dropped in favor of what they wrap, whatever they are', '\\name{a}\\title{See \\link[base]{sum} and \\acronym{ANOVA}}', (p: RdPage) => assert.strictEqual(p.title, 'See sum and ANOVA')],
	['a usage call broken over several lines is one entry', '\\name{f}\\usage{\nf(x,\n  y = c("a", "b"),\n  ...)\n\ng(x)\n}', (p: RdPage) => assert.deepEqual(p.usage, ['f(x, y = c("a", "b"), ...)', 'g(x)'])],
	['a bracket inside a string does not hold a usage entry open', '\\name{f}\\usage{f(sep = "(")\ng(x)\n}', (p: RdPage) => assert.deepEqual(p.usage, ['f(sep = "(")', 'g(x)'])],
	['an \\S4method usage reads as the alias it is documented under', '\\name{sin}\\usage{\\S4method{sin}{float32}(x)}', (p: RdPage) => assert.deepEqual(p.usage, ['sin,float32-method(x)'])],
	['a usage states the dots parameter as R renders it', '\\name{f}\\usage{\\method{plot}{nash.eq}(x,\\dots)\n\\special{x[i] <- value}}', (p: RdPage) => assert.deepEqual(p.usage, ['plot.nash.eq(x,...)', 'x[i] <- value'])],
	['\\dots names the dots argument', '\\name{f}\\arguments{\\item{\\dots}{the rest}}', (p: RdPage) => assert.strictEqual(p.arguments.get('...'), 'the rest')],
	['an \\item nested in a description does not become an argument', '\\name{f}\\arguments{\\item{x}{one of \\describe{\\item{a}{first}\\item{b}{second}}}\\item{y}{two}}', (p: RdPage) => assert.deepEqual([...p.arguments.keys()], ['x', 'y'])],
	['an unterminated group ends the scan instead of hanging', '\\name{f}\\alias{f}\\arguments{\\item{x}{never closed', (p: RdPage) => assert.deepEqual([p.name, p.aliases], ['f', ['f']])]
] as const)('markup: %s', (_desc, input, check) => check(parseRdPage(input)));

const Macros = parseRdMacros('%% a comment\n\\newcommand{\\pkg}{Matrix}\n\\newcommand{\\twice}{#1 and #1}\n\\renewcommand{\\pair}{#1/#2}');
test('a macro definition states its body, expands where used, applies while parsing a page, and nests through another macro', () => {
	assert.deepEqual([Macros.get('pkg'), Macros.get('twice'), Macros.get('pair')], [{ params: 0, body: 'Matrix' }, { params: 1, body: '#1 and #1' }, { params: 2, body: '#1/#2' }]);
	assert.strictEqual(expandRdMacros('see \\pkg, \\twice{x}, \\pair{a}{b}', Macros), 'see Matrix, x and x, a/b');
	assert.strictEqual(expandRdMacros('\\pair{a}', Macros), '\\pair{a}', 'a use without the groups its definition takes is left as written');
	const source = '\\name{f}\\alias{f}\\title{The \\pkg package}';
	assert.strictEqual(parseRdPage(source, 'f', Macros).title, 'The Matrix package');
	assert.strictEqual(parseRdPage(source, 'f').title, 'The package', 'without them the macro renders as nothing');
	const nested = parseRdMacros('\\newcommand{\\inner}{deep}\\newcommand{\\outer}{very \\inner}');
	assert.strictEqual(expandRdMacros('\\outer', nested), 'very deep');
});

testPage('code and format groups are not text (\\Sexpr, \\ifelse)', '\\name{f}\\title{a \\Sexpr{1 + 1} b}', { title: 'a b' });
testPage('\\ifelse opens with the output format', '\\name{f}\\title{\\ifelse{latex}{maths}{plain}}', { title: 'maths plain' });

test('an INDEX states a topic per entry, with indented lines continuing its title, and alone answers what a package documents', () => {
	const topics = parseRdTopicIndex(['AIC                     Akaike\'s An Information Criterion', '.checkMFClasses         Functions to Check the Type of Variables passed', '                        to Model Frames', '', 'lonely'].join('\n'));
	assert.deepEqual(topics, [['AIC', 'Akaike\'s An Information Criterion'], ['.checkMFClasses', 'Functions to Check the Type of Variables passed to Model Frames'], ['lonely', '']]);
	const index = new RdIndex().addTopics(parseRdTopicIndex('lm    Fitting Linear Models'));
	assert.deepEqual(index.topicOf('lm'), { topic: 'lm', via: RdMatch.Alias });
	assert.isUndefined(index.page('lm'));
	assert.strictEqual(index.title('lm'), 'Fitting Linear Models');
	assert.isFalse(index.documents('nowhere'));
});

test('a datalist states which objects each dataset provides', () => {
	assert.deepEqual(parseDataList('CAex\nKNex\nboth: alpha beta\n\n'), [['CAex', ['CAex']], ['KNex', ['KNex']], ['both', ['alpha', 'beta']]]);
});

const RdPagePlugin = new FlowrAnalyzerRdFilePlugin();
const RdMacroPlugin = new FlowrAnalyzerRdMacroFilePlugin();
const RdTopicsPlugin = new FlowrAnalyzerRdTopicIndexFilePlugin();
const RdMetaPlugin = new FlowrAnalyzerRdMetaFilePlugin();
const RdDataListPlugin = new FlowrAnalyzerDataListFilePlugin();
testApplies('an ordinary page', RdPagePlugin, 'man/print.Rd', true);
testApplies('a page under a subdirectory, uppercase or lowercase extension', RdPagePlugin, 'pkg/man/as.data.frame.rd', true);
testApplies('NEWS.Rd belongs to the NEWS plugin, not this one', RdPagePlugin, 'NEWS.Rd', false);
testApplies('nor an installed NEWS.Rd', RdPagePlugin, 'inst/NEWS.Rd', false);
/* `man/macros/*.Rd` holds `\\newcommand`s; read as a page it would claim its file name as a topic */
testApplies('a macro file is no page', RdPagePlugin, 'man/macros/local.Rd', false);
testApplies('wherever the package sits', RdPagePlugin, 'Matrix/help/macros/local.Rd', false);
testApplies('nor is an R source file', RdPagePlugin, 'R/print.R', false);
testApplies('nor DESCRIPTION', RdPagePlugin, 'DESCRIPTION', false);
testApplies('a macro file goes to the macro plugin instead', RdMacroPlugin, 'man/macros/local.Rd', true);
testApplies('never an ordinary page', RdMacroPlugin, 'man/print.Rd', false);
testApplies('the topic plugin finds an INDEX', RdTopicsPlugin, 'INDEX', true);
testApplies('and a demo index', RdTopicsPlugin, 'demo/00Index', true);
testApplies('but not an html one', RdTopicsPlugin, 'index.html', false);
testApplies('the meta plugin finds Rd.rds', RdMetaPlugin, 'Meta/Rd.rds', true);
testApplies('not package.rds', RdMetaPlugin, 'Meta/package.rds', false);
testApplies('the datalist plugin finds data/datalist', RdDataListPlugin, 'data/datalist', true);
