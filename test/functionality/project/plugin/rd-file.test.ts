import { assert, describe, test } from 'vitest';
import {
	FlowrAnalyzerDataListFilePlugin,
	FlowrAnalyzerRdFilePlugin,
	FlowrAnalyzerRdMacroFilePlugin,
	FlowrAnalyzerRdMetaFilePlugin,
	FlowrAnalyzerRdTopicIndexFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-rd-file-plugin';
import {
	expandRdMacros,
	parseAnIndex,
	parseDataList,
	parseRdMacros,
	parseRdPage,
	parseRdTopicIndex,
	RdIndex,
	RdMatch
} from '../../../../src/project/plugins/file-plugins/files/flowr-rd-file';

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

describe('Rd manual pages', () => {
	const page = parseRdPage(PrintPage, 'fallback');

	test('name, docType, title and keywords', () => {
		assert.strictEqual(page.name, 'print');
		assert.strictEqual(page.docType, 'methods');
		assert.strictEqual(page.title, 'Print Values');
		assert.deepEqual(page.keywords, ['print', 'internal']);
	});

	test('every alias the page documents', () => {
		assert.deepEqual(page.aliases, ['print', 'print.default', 'print,myclass-method', 'dim<-']);
	});

	test('usage renders the method spellings and drops comments', () => {
		assert.deepEqual(page.usage, ['print(x, ...)', 'print.default(x, digits = NULL, ...)']);
	});

	test('an \\item naming two arguments documents both', () => {
		assert.strictEqual(page.arguments.get('x'), 'the object and the digits to use');
		assert.strictEqual(page.arguments.get('digits'), 'the object and the digits to use');
		assert.strictEqual(page.arguments.get('...'), 'further arguments');
	});

	test('a page without a \\name{} falls back to the file name', () => {
		assert.strictEqual(parseRdPage('\\alias{foo}', 'fallback').name, 'fallback');
	});
});

describe('Which page documents a name', () => {
	const index = new RdIndex().add(parseRdPage(PrintPage)).add(parseRdPage('\\name{sum}\\alias{sum}'));

	test('the page itself and its aliases', () => {
		assert.deepEqual(index.topicOf('print'), { topic: 'print', via: RdMatch.Page });
		assert.deepEqual(index.topicOf('print.default'), { topic: 'print', via: RdMatch.Alias });
	});

	test('an S4 method is found from its generic and the other way round', () => {
		assert.deepEqual(index.topicOf('print,myclass-method'), { topic: 'print', via: RdMatch.Alias });
		/* only the `sum,cls-method` spelling is aliased anywhere, so the bare generic answers through it */
		const s4 = new RdIndex().add(parseRdPage('\\name{Arith-methods}\\alias{sum,myclass-method}'));
		assert.deepEqual(s4.topicOf('sum'), { topic: 'Arith-methods', via: RdMatch.S4Method });
	});

	test('a replacement function shares the page of its reader', () => {
		const dim = new RdIndex().add(parseRdPage('\\name{dim}\\alias{dim}'));
		assert.deepEqual(dim.topicOf('dim<-'), { topic: 'dim', via: RdMatch.Replacement });
	});

	test('an S3 method falls back to the page of its generic, longest generic first', () => {
		const idx = new RdIndex().add(parseRdPage('\\name{as.data.frame}\\alias{as.data.frame}'))
			.add(parseRdPage('\\name{as.data}\\alias{as.data}'));
		assert.deepEqual(idx.topicOf('as.data.frame.matrix'), { topic: 'as.data.frame', via: RdMatch.S3Generic });
	});

	test('an undocumented name is answered as such', () => {
		assert.isUndefined(index.topicOf('neverDocumented'));
		assert.isFalse(index.documents('neverDocumented'));
		assert.isTrue(index.documents('sum'));
	});
});

describe('An installed package\'s help/AnIndex', () => {
	const anIndex = 'print\tprint\nprint.default\tprint\nsum\tArith-methods\nbroken line without a tab and more\n';

	test('reads the alias-to-topic pairs', () => {
		assert.deepEqual(parseAnIndex(anIndex), [['print', 'print'], ['print.default', 'print'], ['sum', 'Arith-methods']]);
	});

	test('answers the same questions the pages do, without page content', () => {
		const index = new RdIndex().addAliases(parseAnIndex(anIndex));
		assert.deepEqual(index.topicOf('print.default'), { topic: 'print', via: RdMatch.Alias });
		assert.isUndefined(index.page('print'), 'an AnIndex carries no page');
		assert.isFalse(index.empty);
	});
});

describe('Rd markup that has to survive parsing', () => {
	test('an alias that is itself a brace is the name, not a stray backslash', () => {
		/* base R documents the block operator as `\\alias{\\{}` */
		const page = parseRdPage('\\name{Paren}\\alias{(}\\alias{\\{}\\alias{\\%in\\%}');
		assert.deepEqual(page.aliases, ['(', '{', '%in%']);
	});

	test('a comment runs to the end of its line, an escaped percent does not start one', () => {
		const page = parseRdPage('\\name{a}% dropped \\alias{never}\n\\alias{kept}\n\\title{100\\% sure}');
		assert.deepEqual(page.aliases, ['kept']);
		assert.strictEqual(page.title, '100% sure');
	});

	test('an even run of backslashes leaves the percent a comment', () => {
		/* `\\\\%` is a literal backslash followed by a comment, so nothing after it is markup */
		assert.deepEqual(parseRdPage('\\name{a}\n\\keyword{k}\\\\% \\keyword{dropped}').keywords, ['k']);
	});

	test('markup macros are dropped in favor of what they wrap, whatever they are', () => {
		const page = parseRdPage('\\name{a}\\title{See \\link[base]{sum} and \\acronym{ANOVA}}');
		assert.strictEqual(page.title, 'See sum and ANOVA');
	});

	test('a usage call broken over several lines is one entry', () => {
		const page = parseRdPage(`\\name{f}\\usage{
f(x,
  y = c("a", "b"),
  ...)

g(x)
}`);
		assert.deepEqual(page.usage, ['f(x, y = c("a", "b"), ...)', 'g(x)']);
	});

	test('a bracket inside a string does not hold a usage entry open', () => {
		const page = parseRdPage('\\name{f}\\usage{f(sep = "(")\ng(x)\n}');
		assert.deepEqual(page.usage, ['f(sep = "(")', 'g(x)']);
	});

	test('an \\S4method usage reads as the alias it is documented under', () => {
		const page = parseRdPage('\\name{sin}\\usage{\\S4method{sin}{float32}(x)}');
		assert.deepEqual(page.usage, ['sin,float32-method(x)']);
	});

	test('a usage states the dots parameter as R renders it', () => {
		const page = parseRdPage('\\name{f}\\usage{\\method{plot}{nash.eq}(x,\\dots)\n\\special{x[i] <- value}}');
		assert.deepEqual(page.usage, ['plot.nash.eq(x,...)', 'x[i] <- value']);
	});

	test('\\dots names the dots argument', () => {
		const page = parseRdPage('\\name{f}\\arguments{\\item{\\dots}{the rest}}');
		assert.strictEqual(page.arguments.get('...'), 'the rest');
	});

	test('an \\item nested in a description does not become an argument', () => {
		const page = parseRdPage('\\name{f}\\arguments{\\item{x}{one of \\describe{\\item{a}{first}\\item{b}{second}}}\\item{y}{two}}');
		assert.deepEqual([...page.arguments.keys()], ['x', 'y']);
	});

	test('an unterminated group ends the scan instead of hanging', () => {
		const page = parseRdPage('\\name{f}\\alias{f}\\arguments{\\item{x}{never closed', 'fallback');
		assert.strictEqual(page.name, 'f');
		assert.deepEqual(page.aliases, ['f']);
	});
});

describe('Which files are manual pages', () => {
	const plugin = new FlowrAnalyzerRdFilePlugin();

	test('a page under man/ is one, whatever it is called', () => {
		assert.isTrue(plugin.applies('man/print.Rd'));
		assert.isTrue(plugin.applies('pkg/man/as.data.frame.rd'));
	});

	test('NEWS.Rd is a changelog and belongs to the NEWS plugin', () => {
		assert.isFalse(plugin.applies('NEWS.Rd'));
		assert.isFalse(plugin.applies('inst/NEWS.Rd'));
	});

	test('a macro definition documents nothing, so it is no page', () => {
		/* `man/macros/*.Rd` holds `\\newcommand`s; read as a page it would claim its file name as a topic */
		assert.isFalse(plugin.applies('man/macros/local.Rd'));
		assert.isFalse(plugin.applies('Matrix/help/macros/local.Rd'));
	});

	test('a file that is not Rd at all is none', () => {
		assert.isFalse(plugin.applies('R/print.R'));
		assert.isFalse(plugin.applies('DESCRIPTION'));
	});
});

describe('Package-defined Rd macros', () => {
	const macros = parseRdMacros('%% a comment\n\\newcommand{\\pkg}{Matrix}\n\\newcommand{\\twice}{#1 and #1}\n\\renewcommand{\\pair}{#1/#2}');

	test('a definition states its body and how many arguments it takes', () => {
		assert.deepEqual(macros.get('pkg'), { params: 0, body: 'Matrix' });
		assert.deepEqual(macros.get('twice'), { params: 1, body: '#1 and #1' });
		assert.deepEqual(macros.get('pair'), { params: 2, body: '#1/#2' });
	});

	test('a use is replaced by what it stands for', () => {
		assert.strictEqual(expandRdMacros('see \\pkg, \\twice{x}, \\pair{a}{b}', macros), 'see Matrix, x and x, a/b');
	});

	test('a use without the groups its definition takes is left as written', () => {
		assert.strictEqual(expandRdMacros('\\pair{a}', macros), '\\pair{a}');
	});

	test('a macro whose body uses another is expanded through', () => {
		const nested = parseRdMacros('\\newcommand{\\inner}{deep}\\newcommand{\\outer}{very \\inner}');
		assert.strictEqual(expandRdMacros('\\outer', nested), 'very deep');
	});

	test('a page parsed with them states what it renders', () => {
		const source = '\\name{f}\\alias{f}\\title{The \\pkg package}';
		assert.strictEqual(parseRdPage(source, 'f', macros).title, 'The Matrix package');
		assert.strictEqual(parseRdPage(source, 'f').title, 'The package', 'without them the macro renders as nothing');
	});

	test('code and format groups are not text', () => {
		/* `\\Sexpr` holds R code the manual builder evaluates, `\\ifelse` opens with the output format */
		assert.strictEqual(parseRdPage('\\name{f}\\title{a \\Sexpr{1 + 1} b}').title, 'a b');
		assert.strictEqual(parseRdPage('\\name{f}\\title{\\ifelse{latex}{maths}{plain}}').title, 'maths plain');
	});
});

describe('The tables R keeps beside the pages', () => {
	test('an INDEX states a topic per entry, with indented lines continuing its title', () => {
		const index = parseRdTopicIndex([
			'AIC                     Akaike\'s An Information Criterion',
			'.checkMFClasses         Functions to Check the Type of Variables passed',
			'                        to Model Frames',
			'',
			'lonely'
		].join('\n'));
		assert.deepEqual(index, [
			['AIC', 'Akaike\'s An Information Criterion'],
			['.checkMFClasses', 'Functions to Check the Type of Variables passed to Model Frames'],
			['lonely', '']
		]);
	});

	test('an INDEX alone answers what a package documents', () => {
		const index = new RdIndex().addTopics(parseRdTopicIndex('lm    Fitting Linear Models'));
		/* a table states no page content, so the topic is known by its own name rather than by a parsed page */
		assert.deepEqual(index.topicOf('lm'), { topic: 'lm', via: RdMatch.Alias });
		assert.isUndefined(index.page('lm'));
		assert.strictEqual(index.title('lm'), 'Fitting Linear Models');
		assert.isFalse(index.documents('nowhere'));
	});

	test('a datalist states which objects each dataset provides', () => {
		assert.deepEqual(parseDataList('CAex\nKNex\nboth: alpha beta\n\n'), [
			['CAex', ['CAex']],
			['KNex', ['KNex']],
			['both', ['alpha', 'beta']]
		]);
	});
});

describe('Which plugin claims which file', () => {
	const page = new FlowrAnalyzerRdFilePlugin();
	const macro = new FlowrAnalyzerRdMacroFilePlugin();
	const topics = new FlowrAnalyzerRdTopicIndexFilePlugin();
	const meta = new FlowrAnalyzerRdMetaFilePlugin();
	const datalist = new FlowrAnalyzerDataListFilePlugin();

	test('a macro file goes to the macro plugin, never to the page one', () => {
		assert.isTrue(macro.applies('man/macros/local.Rd'));
		assert.isFalse(page.applies('man/macros/local.Rd'));
		assert.isFalse(macro.applies('man/print.Rd'), 'an ordinary page is no macro file');
	});

	test('the topic tables, the help table and the datalist each find their own', () => {
		assert.isTrue(topics.applies('INDEX'));
		assert.isTrue(topics.applies('demo/00Index'));
		assert.isTrue(meta.applies('Meta/Rd.rds'));
		assert.isTrue(datalist.applies('data/datalist'));
		assert.isFalse(topics.applies('index.html'));
		assert.isFalse(meta.applies('Meta/package.rds'));
	});
});
