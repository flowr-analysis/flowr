import { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { FlowrWikiBaseRef, linkFlowRSourceFile } from './doc-util/doc-files';
import { CmdCheckConformance, CmdCheckSource, type ConformanceEntry, ConformanceLevel, numberedConformance, RPackagesCmdCheck, WritingRExtensionsCmdCheck } from '../linter/rules/cmd-check/conformance';
import { type LintingRuleNames, LintingRules } from '../linter/linter-rules';
import { codeBlock } from './doc-util/doc-code';
import { showQuery } from './doc-util/doc-query';
import { fileProtocol } from '../r-bridge/retriever';
import { type TypeElementInSource, type TypeReport, getDocumentationForType, getTypePathLink, getTypesFromFolder, mermaidHide, shortLink, shortLinkFile } from './doc-util/doc-types';
import path from 'path';
import { isNotUndefined  } from '../util/assert';
import { documentReplSession } from './doc-util/doc-repl';
import { block, section } from './doc-util/doc-structure';
import { LintingRuleTag } from '../linter/linter-tags';
import { textWithTooltip } from '../util/html-hover-over';
import { joinWithLast } from '../util/text/strings';
import { getFunctionsFromFolder } from './doc-util/doc-functions';
import { LintingResultCertainty, LintingRuleCertainty } from '../linter/linter-format';
import { LintQuickFixes } from '../linter/linter-fix';
import type { LinterOutputFormat } from '../linter/linter-output';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import type { GeneralDocContext } from './wiki-mk/doc-context';
import type { KnownParser } from '../r-bridge/parser';
import { FlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { FlowrConfig } from '../config';

const documentedContext = new FlowrAnalyzerContext(FlowrConfig.default());

/** one color per role of a tag: the kind of issue, R CMD check, quick fixes, the status of a rule, and every other aspect */
const TagColors: Readonly<Partial<Record<LintingRuleTag, string>>> = {
	[LintingRuleTag.Bug]:          'red',
	[LintingRuleTag.Smell]:        'yellow',
	[LintingRuleTag.Style]:        'blue',
	[LintingRuleTag.CmdCheck]:     'blueviolet',
	[LintingRuleTag.QuickFix]:     'brightgreen',
	[LintingRuleTag.Experimental]: 'lightgrey'
};
const AspectColor = 'teal';

const ConformancePageName = 'R CMD check Conformance';
const ConformancePage = `${FlowrWikiBaseRef}/${ConformancePageName.replaceAll(' ', '-')}`;

/** text as a part of a shields.io badge url */
const shield = (text: string) => encodeURIComponent(text.replaceAll('-', '--').replaceAll('_', '__'));

function makeTagBadge(name: LintingRuleTag, info: TypeElementInSource[], message?: string, href = `${FlowrWikiBaseRef}/Linter#${name}`): string {
	const doc = getDocumentationForType('LintingRuleTag::' + name, info, '', { fuzzy: true }).replaceAll('\n', ' ');
	const color = TagColors[name] ?? AspectColor;
	const badge = message === undefined ? `${shield(name)}-${color}` : `${shield(name)}-${shield(message)}-${color}`;
	return textWithTooltip(`<a href='${href}'>![${name}${message === undefined ? '' : ` ${message}`}](https://img.shields.io/badge/${badge}) </a>`, doc);
}

function getPageNameForLintingRule(name: LintingRuleNames): string {
	// convert file-path-validity to 'Linting Rule: File Path Validity'
	const words = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1));
	return '[Linting Rule] ' + words.join(' ');
}

/** how wide one line of an expected-result block may get before its entries are broken apart */
const ExpectedWidth = 160;

/**
 * The expected results of a linter test case as they appear in the wiki: the source text of the array, with its
 * layout dropped, one element per line, and everything that fits on one line kept there.
 */
function prettyPrintExpectedOutput(expected: string): string {
	const text = expected.trim();
	if(text === '[]') {
		return '* no lints';
	}
	const compact = collapseWhitespace(text);
	if(compact.length <= ExpectedWidth || !compact.startsWith('[')) {
		return compact;
	}
	const elements = splitTopLevel(compact.slice(1, -1));
	return elements.length <= 1 ? compact : `[\n\t${elements.join(',\n\t')}\n]`;
}

/**
 * The results a linter test case expects, as one line each: what the rule reports, where, and how sure it is.
 * The source text of anything this cannot read stays a code block.
 */
function describeExpectedResults(expected: string): string {
	const text = collapseWhitespace(expected.trim());
	if(text === '[]') {
		return '* no lints';
	}
	if(!text.startsWith('[')) {
		return codeBlock('ts', text);
	}
	const described = splitTopLevel(text.slice(1, -1)).map(describeExpectedResult);
	return described.every(isNotUndefined) && described.length > 0
		? described.map(line => `* ${line}`).join('\n')
		: codeBlock('ts', prettyPrintExpectedOutput(expected));
}

/** `{certainty: ..., name: 'x', loc: [1, 1, 1, 2]}` as `certain at 1.1-1.2: name = 'x'` */
function describeExpectedResult(element: string): string | undefined {
	const body = /^\{(.*)\}(?: as const)?$/.exec(element.trim())?.[1];
	if(body === undefined) {
		return undefined;
	}
	const fields = new Map<string, string>();
	for(const part of splitTopLevel(body)) {
		const at = part.indexOf(':');
		if(at < 0) {
			return undefined;
		}
		fields.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
	}
	const parts: string[] = [];
	for(const [key, value] of fields) {
		if(key === 'certainty' || key === 'loc' || value === 'undefined') {
			continue;
		} else if(key === 'quickFix') {
			const fixes = splitTopLevel(value.replace(/^\[/, '').replace(/]$/, '')).length;
			parts.push(`${fixes} quick fix${fixes === 1 ? '' : 'es'}`);
		} else {
			parts.push(`${key} = \`${value}\``);
		}
	}
	const where = locationOf(fields.get('loc'));
	const certainty = fields.get('certainty')?.split('.').at(-1)?.toLowerCase() ?? 'reported';
	return `${certainty}${where ? ` at ${where}` : ''}${parts.length > 0 ? `: ${parts.join(', ')}` : ''}`;
}

/** `[1, 1, 1, 2]` as `1.1-1.2`, `undefined` for anything else */
function locationOf(loc: string | undefined): string | undefined {
	const at = /^\[\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*]$/.exec(loc ?? '');
	return at ? `${at[1]}.${at[2]}-${at[3]}.${at[4]}` : undefined;
}

/** the text with every run of whitespace outside a string literal reduced to one space */
function collapseWhitespace(text: string): string {
	let out = '';
	let quote: string | undefined;
	let space = false;
	for(let i = 0; i < text.length; i++) {
		const c = text[i];
		if(quote !== undefined) {
			out += c;
			if(c === '\\') {
				out += text[++i] ?? '';
			} else if(c === quote) {
				quote = undefined;
			}
			continue;
		}
		if(/\s/.test(c)) {
			space = out.length > 0;
			continue;
		}
		if(space && !'}])'.includes(c) && !'{[('.includes(out[out.length - 1])) {
			out += ' ';
		}
		space = false;
		if(c === ',' && /[}\]]/.test(nextNonSpace(text, i + 1))) {
			continue;   /* a trailing comma the source needed for its layout says nothing here */
		}
		out += c;
		if(c === '\'' || c === '"' || c === '`') {
			quote = c;
		}
	}
	return out;
}

/** the next character of `text` from `at` that is not a space */
function nextNonSpace(text: string, at: number): string {
	for(let i = at; i < text.length; i++) {
		if(!/\s/.test(text[i])) {
			return text[i];
		}
	}
	return '';
}

/** the comma-separated parts of `text`, splitting only where no bracket or string is open */
function splitTopLevel(text: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote: string | undefined;
	let start = 0;
	for(let i = 0; i < text.length; i++) {
		const c = text[i];
		if(quote !== undefined) {
			if(c === '\\') {
				i++;
			} else if(c === quote) {
				quote = undefined;
			}
		} else if(c === '\'' || c === '"' || c === '`') {
			quote = c;
		} else if('{[('.includes(c)) {
			depth++;
		} else if('}])'.includes(c)) {
			depth--;
		} else if(c === ',' && depth === 0) {
			parts.push(text.slice(start, i).trim());
			start = i + 1;
		}
	}
	const rest = text.slice(start).trim();
	if(rest !== '') {
		parts.push(rest);
	}
	return parts;
}

function buildSamplesFromLinterTestCases(_parser: KnownParser, testFile: string): string {
	const reports = getFunctionsFromFolder({ files: [path.resolve('test/functionality/linter/' + testFile)], fname: /assertLinter/ });
	if(reports.info.length === 0) {
		return '';
	}
	let result = `#### Additional Examples
	
These examples are synthesized from the test cases in: ${linkFlowRSourceFile('test/functionality/linter/' + testFile)}\n\n`;

	for(const report of reports.info) {
		const args = report.arguments;
		if(args.length < 5) {
			console.error('Test case for linter rule ' + report.name + ' does not have enough arguments! Expected at least 5, got ' + args.length);
			continue;
		}
		const testName = args[0].getText(report.source);
		if(report.comments?.some(c => c.includes('@ignore-in-wiki'))) {
			continue;
		}
		// drop any quotes around the test name
		const testNameClean = RString.unquote(testName);
		result += `\n${section('Test Case: ' + testNameClean, 4)}

${report.comments ? report.comments.map(c => `> ${c}`).join('\n') + '\n' : ''}
Given the following input:
${codeBlock('r', RString.unquote(args[2].getText(report.source)).replace(/\\n/g, '\n'))}
${args.length >= 7 ? `\nAnd using the following [configuration](#configuration): ${codeBlock('ts', prettyPrintExpectedOutput(args[6].getText(report.source)))}` : ''}

We expect the linter to report the following:

${describeExpectedResults(args[4].getText(report.source))}


See [here](${getTypePathLink({ filePath: report.source.fileName, lineNumber: report.lineNumber })}) for the test-case implementation.
		`;
	}

	return result;
}

/** an example that needs files besides its code shows them as a project, its code in `R/code.R` */
export interface PackageExample {
	readonly code:  string
	readonly files: Readonly<Record<string, string>>
}

const ExampleDescription = 'Package: pkg\nVersion: 1.0\nTitle: A Package\nLicense: MIT\n';
const ExampleRoot = '/pkg';

/** what the wiki shows for each linting rule: its configuration and implementation types, its tests, and an example with findings */
export const LintingRuleExamples: Readonly<Record<LintingRuleNames, { readonly configType: string, readonly ruleType: string, readonly testfile: string, readonly example: string | PackageExample, readonly config?: object }>> = {
	'deprecated-functions': {
		configType: 'DeprecatedFunctionsConfig', ruleType:   'DEPRECATED_FUNCTIONS', testfile:   'lint-deprecated-functions',
		example:    `
first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)

library(ggplot2)
theme(panel.grid = element_line(size = 1))
`
	},
	'network-functions': {
		configType: 'NetworkFunctionsConfig', ruleType:   'NETWORK_FUNCTIONS', testfile:   'lint-network-functions',
		example:    `
read.csv("https://example.com/data.csv")
download.file("https://foo.bar")
`
	},
	'file-path-validity': {
		configType: 'FilePathValidityConfig', ruleType:   'FILE_PATH_VALIDITY', testfile:   'lint-file-path-validity',
		example:    { code: 'survey <- read.csv("data/Survey.csv")', files: { 'R/survey.csv': 'id,value\n1,2\n' } }
	},
	'absolute-file-paths': {
		configType: 'AbsoluteFilePathConfig', ruleType:   'ABSOLUTE_PATH', testfile:   'lint-absolute-path',
		example:    'read.csv("/home/me/project/data/survey.csv")',
		config:     { useAsWd: '/home/me/project' }
	},
	'unused-definitions': {
		configType: 'UnusedDefinitionConfig', ruleType:   'UNUSED_DEFINITION', testfile:   'lint-unused-definition',
		example:    `
x <- 42
y <- 3
print(x)
`
	},
	'seeded-randomness': {
		configType: 'SeededRandomnessConfig', ruleType:   'SEEDED_RANDOMNESS', testfile:   'lint-seeded-randomness',
		example:    'runif(1)'
	},
	'naming-convention': {
		configType: 'NamingConventionConfig', ruleType:   'NAMING_CONVENTION', testfile:   'lint-naming-convention',
		example:    `
testVar <- 5
testVarTwo <- 5
other_var <- 5
`
	},
	'dataframe-access-validation': {
		configType: 'DataFrameAccessValidationConfig', ruleType:   'DATA_FRAME_ACCESS_VALIDATION', testfile:   'lint-dataframe-access-validation',
		example:    `
df <- data.frame(id = 1:5, name = 6:10)
df[6, "value"]
`
	},
	'dead-code': {
		configType: 'DeadCodeConfig', ruleType:   'DEAD_CODE', testfile:   'lint-dead-code',
		example:    `
f <- function(x) {
	return(x)
	print("never reached")
}
if(TRUE) 1 else 2
`
	},
	'useless-loop': {
		configType: 'UselessLoopConfig', ruleType:   'USELESS_LOOP', testfile:   'lint-useless-loop',
		example:    'for(i in c(1)) { print(i) }'
	},
	'stop-call': {
		configType: 'StopWithCallConfig', ruleType:   'STOP_WITH_CALL_ARG', testfile:   'lint-stop-call',
		example:    'f <- function(x) stop(x)'
	},
	'roxygen-arguments': {
		configType: 'RoxygenArgsConfig', ruleType:   'ROXYGEN_ARGS', testfile:   'lint-roxygen-arguments',
		example:    '#\' A function with two parameters, but only only one documented\n#\' @param a A variable\nf = function(a, b){return a;}'
	},
	'problematic-inputs': {
		configType: 'ProblematicInputsConfig', ruleType:   'PROBLEMATIC_INPUTS', testfile:   'lint-problematic-inputs',
		example:    `
function(x) {
	eval(x)
}
`
	},
	'software-has-license': {
		configType: 'SoftwareHasLicenseConfig', ruleType:   'SOFTWARE_HAS_LICENSE', testfile:   'lint-software-has-license',
		example:    'cat("a project without a license")'
	},
	'software-has-tests': {
		configType: 'SoftwareHasTestsConfig', ruleType:   'SOFTWARE_HAS_TESTS', testfile:   'lint-software-has-tests',
		example:    'cat("hello")'
	},
	'no-leaked-credentials': {
		configType: 'NoLeakedCredentialsConfig', ruleType:   'NO_LEAKED_CREDENTIALS', testfile:   'lint-no-leaked-credentials',
		example:    'password <- "s3cr3t"'
	},
	'undefined-symbol': {
		configType: 'UndefinedSymbolConfig', ruleType:   'UNDEFINED_SYMBOL', testfile:   'lint-undefined-symbol',
		example:    'undefined_helper(42)'
	},
	'syntactically-valid': {
		configType: 'SyntacticallyValidConfig', ruleType:   'SYNTACTICALLY_VALID', testfile:   'lint-syntactically-valid',
		example:    'x <- c(1, 2'
	},
	'unclosed-connection': {
		configType: 'UnclosedConnectionConfig', ruleType:   'UNCLOSED_CONNECTION', testfile:   'lint-unclosed-connection',
		example:    'con <- file("data.csv")\nreadLines(con)'
	},
	'unused-import': {
		configType: 'UnusedImportConfig', ruleType:   'UNUSED_IMPORT', testfile:   'lint-unused-import',
		example:    'library(stats)\nprint("no stats function is used")'
	},
	'unescaped-arguments': {
		configType: 'UnescapedArgumentsConfig', ruleType:   'UNESCAPED_ARGUMENTS', testfile:   'lint-unescaped-arguments',
		example:    'function(dir) {\n\tsystem(paste0("ls ", dir))\n}'
	},
	'namespace-access': {
		configType: 'NamespaceAccessConfig', ruleType:   'NAMESPACE_ACCESS', testfile:   'lint-namespace-access',
		example:    'dplyr:::filter(df, x > 1)'
	},
	'description-metadata': {
		configType: 'DescriptionMetadataConfig', ruleType:   'DESCRIPTION_METADATA', testfile:   'cmd-check/lint-description-metadata',
		example:    { code: 'x <- 1', files: { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nTitle: A Package\nLicense: GPL-3 + file LICENSE\n' } }
	},
	'documentation-mismatch': {
		configType: 'DocumentationMismatchConfig', ruleType:   'DOCUMENTATION_MISMATCH', testfile:   'cmd-check/lint-documentation-mismatch',
		example:    { code: 'f <- function(x, y) x + y', files: { DESCRIPTION: ExampleDescription, 'NAMESPACE': 'export(f)\n', 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{Add}\n\\usage{f(x)}\n\\arguments{\\item{x}{a number}}\n' } }
	},
	'non-ascii-code': {
		configType: 'NonAsciiCodeConfig', ruleType:   'NON_ASCII_CODE', testfile:   'cmd-check/lint-non-ascii-code',
		example:    'escaped <- function() message("Gr\\u00fc\\u00dfe")\nliteral <- function() message("Gr\u00fc\u00dfe")'
	},
	'class-string-comparison': {
		configType: 'ClassStringComparisonConfig', ruleType:   'CLASS_STRING_COMPARISON', testfile:   'cmd-check/lint-class-string-comparison',
		example:    'f <- function(x) if(class(x) == "data.frame") nrow(x) else length(x)'
	},
	'true-false-abbreviation': {
		configType: 'TrueFalseAbbreviationConfig', ruleType:   'TRUE_FALSE_ABBREVIATION', testfile:   'cmd-check/lint-true-false-abbreviation',
		example:    'f <- function(x) mean(x, na.rm = T)'
	},
	'bogus-return': {
		configType: 'BogusReturnConfig', ruleType:   'BOGUS_RETURN', testfile:   'cmd-check/lint-bogus-return',
		example:    'f <- function(x) {\n\tif(is.null(x)) return\n\tx + 1\n}'
	},
	'package-hooks': {
		configType: 'PackageHooksConfig', ruleType:   'PACKAGE_HOOKS', testfile:   'cmd-check/lint-package-hooks',
		example:    '.onLoad <- function(libname, pkgname) {\n\tlibrary(stats)\n\tcat("Loading")\n}\n.onAttach <- function(libname, pkgname) message("Welcome!")'
	},
	'global-environment-modification': {
		configType: 'GlobalEnvironmentModificationConfig', ruleType:   'GLOBAL_ENVIRONMENT_MODIFICATION', testfile:   'cmd-check/lint-global-environment-modification',
		example:    'cache <- function(v) assign("cached", v, envir = globalenv())\ncount <- function() counter <<- counter + 1'
	},
	'namespace-tampering': {
		configType: 'NamespaceTamperingConfig', ruleType:   'NAMESPACE_TAMPERING', testfile:   'cmd-check/lint-namespace-tampering',
		example:    'patch <- function() assignInNamespace("mean", function(x, ...) 42, "base")'
	},
	's3-method-consistency': {
		configType: 'S3MethodConsistencyConfig', ruleType:   'S3_METHOD_CONSISTENCY', testfile:   'cmd-check/lint-s-three-method-consistency',
		example:    'print.myclass <- function(obj) cat("myclass")\n`size<-` <- function(x, v) { attr(x, "size") <- v; x }'
	},
	'foreign-function-calls': {
		configType: 'ForeignFunctionCallsConfig', ruleType:   'FOREIGN_FUNCTION_CALLS', testfile:   'cmd-check/lint-foreign-function-calls',
		example:    'f <- function(x) .Call("C_mean", x)'
	},
	'dependency-declaration': {
		configType: 'DependencyDeclarationConfig', ruleType:   'DEPENDENCY_DECLARATION', testfile:   'cmd-check/lint-dependency-declaration',
		example:    { code: 'f <- function(df) {\n\tlibrary(dplyr)\n\ttidyr::drop_na(df)\n}', files: { DESCRIPTION: ExampleDescription } }
	},
	'call-arguments': {
		configType: 'CallArgumentsConfig', ruleType:   'CALL_ARGUMENTS', testfile:   'cmd-check/lint-call-arguments',
		example:    'scale_by <- function(x, factor) x * factor\nf <- function(x) scale_by(x, fact = 2, center = TRUE)'
	},
	'package-structure': {
		configType: 'PackageStructureConfig', ruleType:   'PACKAGE_STRUCTURE', testfile:   'cmd-check/lint-package-structure',
		example:    { code: 'f <- function() 1', files: { DESCRIPTION: ExampleDescription, 'R/a:b.R': 'g <- function() 2\n' } }
	},
	'compiled-code': {
		configType: 'CompiledCodeConfig', ruleType:   'COMPILED_CODE', testfile:   'cmd-check/lint-compiled-code',
		example:    { code: 'f <- function(x) .Call("C_f", x)', files: { DESCRIPTION: ExampleDescription, 'NAMESPACE': 'useDynLib(pkg)\nexport(f)\n', 'src/Makevars': 'PKG_CXXFLAGS = -O3 -Wall -fPIC\n' } }
	},
	'package-metafiles': {
		configType: 'PackageMetafilesConfig', ruleType:   'PACKAGE_METAFILES', testfile:   'cmd-check/lint-package-metafiles',
		example:    { code: 'f <- function() 1', files: { DESCRIPTION: ExampleDescription, 'demo/a.R': 'f()\n', 'demo/b.R': 'f() + 1\n', 'demo/00Index': 'a    A first demo\n' } }
	},
	'rd-files': {
		configType: 'RdFilesConfig', ruleType:   'RD_FILES', testfile:   'cmd-check/lint-rd-files',
		example:    { code: 'f <- function(x) x', files: { DESCRIPTION: ExampleDescription, 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{F}\n\\description{D}\n\\details{\n  a \\foo{x}}\n' } }
	},
	'package-data': {
		configType: 'PackageDataConfig', ruleType:   'PACKAGE_DATA', testfile:   'cmd-check/lint-package-data',
		example:    { code: 'f <- function() 1', files: { DESCRIPTION: ExampleDescription, 'data/notes.md': 'what the data means\n' } }
	},
	'package-runtime': {
		configType: 'PackageRuntimeConfig', ruleType:   'PACKAGE_RUNTIME', testfile:   'cmd-check/lint-package-runtime',
		example:    { code: 'f <- function() 1', files: { DESCRIPTION: ExampleDescription, 'NAMESPACE': 'export(f)\nexport(g)\n' } }
	}
};

/** the kinds of issue a rule finds, each rule carries at most one */
const RuleKinds = [
	[LintingRuleTag.Bug, 'Bugs'],
	[LintingRuleTag.Smell, 'Smells'],
	[LintingRuleTag.Style, 'Style']
] as const;

/** the tags of a rule as the wiki shows them: its kind, R CMD check, quick fixes, then the aspects by name */
function sortedTags(tags: readonly LintingRuleTag[]): LintingRuleTag[] {
	const rank = (t: LintingRuleTag) => RuleKinds.some(([k]) => k === t) ? 0 : t === LintingRuleTag.CmdCheck ? 1 : t === LintingRuleTag.QuickFix ? 2 : 3;
	return tags.toSorted((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** one table per kind of rule, the rules without a kind check the files of a package */
function rulesOverview(info: TypeElementInSource[]): string {
	const names = (Object.keys(LintingRules) as LintingRuleNames[]).toSorted((a, b) => LintingRules[a].info.name.localeCompare(LintingRules[b].info.name));
	const kindOf = (name: LintingRuleNames) => RuleKinds.find(([k]) => (LintingRules[name].info.tags as readonly LintingRuleTag[]).includes(k))?.[0];
	const row = (name: LintingRuleNames) => {
		const rule = LintingRules[name].info;
		const finds = rule.description.split(/\.\s+(?=[A-Z`])/)[0].replace(/^Finds /, '').replace(/\.$/, '');
		const badges = sortedTags(rule.tags as readonly LintingRuleTag[]).filter(t => !RuleKinds.some(([k]) => k === t)).map(t => makeTagBadge(t, info));
		/* the steps are text, a badge naming them grows with them and squeezes the others */
		const step = (n: number) => `[${n}](${ConformancePage}#cmd-check-${n})`;
		const steps = cmdCheckRuns(name).map(r => r.from === r.to ? step(r.from) : `${step(r.from)}–${step(r.to)}`).join(', ');
		return `| [${rule.name}](${FlowrWikiBaseRef}/${encodeURIComponent(getPageNameForLintingRule(name))}) | ${finds.replaceAll('|', '\\|')}${steps === '' ? '' : `<br><sub>R CMD check ${steps}</sub>`} | ${badges.join(' ')} |`;
	};
	const groups = [...RuleKinds.map(([kind, title]) => [title, names.filter(n => kindOf(n) === kind)] as const), ['Package Files', names.filter(n => kindOf(n) === undefined)] as const];
	const anchor = (title: string) => `rules-${title.toLowerCase().replaceAll(' ', '-')}`;
	const toc = groups.map(([title, rules]) => `[${title}](#${anchor(title)}) (${rules.length})`).join(', ');
	return `${toc}\n\n` + groups
		.map(([title, rules]) => `${section(title, 3, anchor(title))}

| Rule | Finds | Tags |
| :-- | :-- | :-- |
${rules.map(row).join('\n')}`).join('\n\n');
}

function registerRules(knownParser: KnownParser, tagTypes: TypeElementInSource[]) {
	const ruleExplanations = new Map<LintingRuleNames, () => Promise<string>>();

	for(const [name, { configType, ruleType, testfile, example, config }] of Object.entries(LintingRuleExamples)) {
		rule(knownParser, name as LintingRuleNames, configType, ruleType, testfile, example, config, tagTypes);
	}

	function rule(parser: KnownParser, name: LintingRuleNames, configType: string, ruleType: string, testfile: string, example: string | PackageExample, config: object | undefined, types: TypeElementInSource[]) {
		const rule = LintingRules[name];

		const tags = sortedTags(rule.info.tags).map(t => t === LintingRuleTag.CmdCheck ? cmdCheckBadge(name, types) : makeTagBadge(t, types)).join(' ');

		const certaintyDoc = getDocumentationForType(`LintingRuleCertainty::${rule.info.certainty}`, types, '', { fuzzy: true }).replaceAll('\n', ' ');
		const certaintyText = textWithTooltip(`<code>${rule.info.certainty}</code>`, certaintyDoc);
		ruleExplanations.set(name, async() => `

${autoGenHeader({ filename: module.filename, purpose: 'linter' })}
${section(rule.info.name + `&emsp;<sup>[<a href="${FlowrWikiBaseRef}/Linter">overview</a>]</sup>`, 2, name)}

${tags}

${cmdCheckStepsOf(name)}

This rule is a ${certaintyText} rule.
 
${rule.info.description}\\
_This linting rule is implemented in ${shortLinkFile(ruleType, types)}._


### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The \`${name}\` rule accepts the following configuration options:

${
	Object.keys(LintingRules[name].info.defaultConfig(documentedContext)).sort().map(key =>
		`- ${shortLink(`${configType}:::${key}`, types)}\\\n${getDocumentationForType(`${configType}::${key}`, types)}${cmdCheckStepsOfOption(name, key)}`
	).join('\n')
}

### Examples

${typeof example === 'string' ? codeBlock('r', example) : `A project with the code \`R/code.R\`:\n\n${codeBlock('r', example.code)}\n\nand the files\n\n${Object.entries(example.files).map(([file, content]) => `\`${file}\`:\n\n${codeBlock(file.endsWith('.R') ? 'r' : 'text', content.trimEnd())}`).join('\n\n')}`}

The linting query can be used to run this rule on the above example:

${await exampleQuery(parser, name, example, config)}

${(rule.info.tags as readonly LintingRuleTag[]).includes(LintingRuleTag.CmdCheck) ? `More examples are the test cases in ${linkFlowRSourceFile(`test/functionality/linter/${testfile}.test.ts`)}.` : buildSamplesFromLinterTestCases(parser, `${testfile}.test.ts`)}

		`.trim());
	}

	return ruleExplanations;
}

/** runs the linter query on a rule's wiki example, refusing an example that shows no finding or an error */
async function exampleQuery(parser: KnownParser, name: LintingRuleNames, example: string | PackageExample, config: object = {}): Promise<string> {
	const queries = [{ type: 'linter', rules: [{ name, config: config as never }] }] as const;
	const shown = typeof example === 'string' ? await showQuery(parser, example, queries, { collapseQuery: true })
		: await showQuery(parser, `${fileProtocol}${ExampleRoot}/R/code.R`, queries, {
			collapseQuery: true,
			files:         [['R/code.R', example.code] as const, ...Object.entries(example.files)].map(([file, content]) => ({ name: `${ExampleRoot}/${file}`, content }))
		});
	if(shown.includes('_no findings_') || shown.includes('Error during execution of rule') || shown.includes('rules failed to execute')) {
		throw new Error(`the wiki example of ${name} must show a finding: ${shown}`);
	}
	return shown;
}

const ConformanceSymbol: Readonly<Record<ConformanceLevel, string>> = {
	[ConformanceLevel.Full]:    '🟩',
	[ConformanceLevel.Static]:  '🔷',
	[ConformanceLevel.Partial]: '🔶'
};

/** the R CMD check steps a rule covers, consecutive steps joined into one run */
function cmdCheckRuns(name: LintingRuleNames): { from: number, to: number }[] {
	const runs: { from: number, to: number }[] = [];
	for(const e of numberedConformance().filter(e => e.rules.includes(name))) {
		const last = runs.at(-1);
		if(last !== undefined && last.to + 1 === e.number) {
			last.to = e.number;
		} else {
			runs.push({ from: e.number, to: e.number });
		}
	}
	return runs;
}

/** the cmd-check badge, naming the R CMD check steps the rule covers */
function cmdCheckBadge(name: LintingRuleNames, info: TypeElementInSource[]): string {
	const steps = cmdCheckRuns(name).map(r => r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`).join(', ');
	return steps === '' ? makeTagBadge(LintingRuleTag.CmdCheck, info) : makeTagBadge(LintingRuleTag.CmdCheck, info, steps, `${ConformancePage}`);
}

const MoreThanCmdCheck = '⭐';

/** how much of a step flowR covers, starred when it reports more */
function cmdCheckCoverage(e: ConformanceEntry): string {
	return `${ConformanceSymbol[e.level]}${e.adds === undefined ? '' : MoreThanCmdCheck}`;
}

/** what flowR adds to a step and what it leaves out */
function cmdCheckNote(e: ConformanceEntry): string {
	return [e.adds === undefined ? undefined : `${MoreThanCmdCheck} also ${e.adds}`, e.note].filter(n => n !== undefined).join('<br>').replaceAll('|', '\\|');
}

/** an R CMD check step, linked to its code in R's `check.R` and its section in R Packages */
function cmdCheckStep(e: ConformanceEntry): string {
	return `[${e.check.replaceAll('|', '\\|')}](${CmdCheckSource}#L${e.line}) ([book](${RPackagesCmdCheck}#${e.book}))`;
}

/** links to the R CMD check steps that `option` of rule `name` tunes */
function cmdCheckStepsOfOption(name: LintingRuleNames, option: string): string {
	const steps = numberedConformance().filter(e => e.options?.includes(`${name}.${option}`));
	return steps.length === 0 ? '' : `\\\n_R CMD check ${steps.map(e => `[#${e.number}](${ConformancePage}#cmd-check-${e.number} "checking ${e.check.replaceAll('"', '\'')}")`).join(', ')}_`;
}

/** the R CMD check steps a rule covers, each linked to the code of R that performs it */
function cmdCheckStepsOf(name: LintingRuleNames): string {
	const steps = numberedConformance().filter(e => e.rules.includes(name));
	return steps.length === 0 ? '' : `This rule ports the following steps of \`R CMD check\` (see the [conformance table](${ConformancePage}) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
${steps.map(e => `| [${e.number}](${ConformancePage}#cmd-check-${e.number}) | ${cmdCheckStep(e)} | ${cmdCheckCoverage(e)} | ${cmdCheckNote(e)} |`).join('\n')}`;
}

function getAllLintingRulesWithTag(tag: LintingRuleTag): LintingRuleNames[] {
	return Object.entries(LintingRules).filter(([_, rule]) => (rule.info.tags as readonly LintingRuleTag[]).includes(tag)).map(([name]) => name as LintingRuleNames);
}

function getAllLintingRulesWitCertainty(certainty: LintingRuleCertainty): LintingRuleNames[] {
	return Object.entries(LintingRules).filter(([_, rule]) => rule.info.certainty === certainty).map(([name]) => name as LintingRuleNames);
}

function linkToRule(name: LintingRuleNames): string {
	return `[${name}](${FlowrWikiBaseRef}/${encodeURIComponent(getPageNameForLintingRule(name).replaceAll(' ', '-'))})`;
}

async function getTextMainPage(knownParser: KnownParser, tagTypes: TypeReport, ctx: GeneralDocContext): Promise<string> {
	return `
This page describes the flowR linter, which is a tool that utilizes flowR's dataflow analysis to find common issues in R scripts. The linter can currently be used through the linter ${ctx.linkPage('wiki/Query API', 'query')}.
Some rules also draw on the ${ctx.linkPage('wiki/Signature Database', 'signature database')}.
For example:

${await (async() => {
	const code = 'read.csv("/root/x.txt")';
	const res = await showQuery(knownParser, code, [{ type: 'linter' }], { showCode: false, collapseQuery: true, collapseResult: false });
	return await documentReplSession(knownParser, [{
		command:     `:query @linter ${JSON.stringify(code)}`,
		description: `
The linter will analyze the code and return any issues found.
Formatted more nicely, this returns:

${res}
		`
	}]
	);
})()}

${section('Linting Rules', 2, 'linting-rules')}

${block({
	type:    'NOTE',
	content: `If you want to add a new linting rule, see ${ctx.linkPage('wiki/Create Linting Rules')}.`
})}

The following linting rules are available, grouped by the kind of issue they find.
Badges link to the [tags](#tags), steps of \`R CMD check\` to the [conformance page](${ConformancePage}).

${rulesOverview(tagTypes.info)}
	
${section('Quick Fixes', 2, 'quick-fixes')}

Rules tagged ${makeTagBadge(LintingRuleTag.QuickFix, tagTypes.info)} attach a ${shortLink('LintQuickFix', tagTypes.info)} to their results,
describing the edit that resolves the finding. flowR does not only report them, it carries them out:
${ctx.link(LintQuickFixes.byFile)} collects the fixes of a lint run per file and ${ctx.link(LintQuickFixes.apply)}
returns that file's content with them applied. Of two overlapping fixes only the one coming first in the file is kept,
and a removal that leaves nothing but whitespace behind takes its line with it.

In ${ctx.linkE<typeof LinterOutputFormat>('LinterOutputFormat', 'Sarif')} output the fixes become SARIF \`fixes\`, which an editor
or code scanner can offer directly. ${ctx.linkE<typeof LinterOutputFormat>('LinterOutputFormat', 'Github')} annotations carry no
fix of their own, so the descriptions are appended to the message.

${section('Tags', 2, 'tags')}

We use tags to categorize linting rules for users. The following tags are available:

| Tag/Badge&emsp;&emsp; | Description |
| --- | :-- |
${Object.entries(LintingRuleTag).map(([name, tag]) => {
	return `| <a id="${tag}"></a> ${(makeTagBadge(tag, tagTypes.info))} | ${getDocumentationForType('LintingRuleTag::' + name, tagTypes.info).replaceAll('\n', ' ')} (rule${getAllLintingRulesWithTag(tag).length === 1 ? '' : 's'}: ${
		joinWithLast(getAllLintingRulesWithTag(tag).map(l => linkToRule(l))) || '_none_'
	}) | `;
}).join('\n')}

${section('Certainty', 2, 'certainty')}

Both linting rules and their individual results are additionally categorized by how certain the linter is that the results it is returning are valid.

${section('Rule Certainty', 3, 'rule-certainty')}

| Rule Certainty | Description |
| -------------- | :---------- |
${Object.entries(LintingRuleCertainty).map(([name, certainty]) => {
	return `| <a id="${certainty}"></a> \`${certainty}\` | ${getDocumentationForType('LintingRuleCertainty::' + name, tagTypes.info).replaceAll('\n', ' ')} (rule${getAllLintingRulesWitCertainty(certainty).length === 1 ? '' : 's'}: ${
		joinWithLast(getAllLintingRulesWitCertainty(certainty).map(l => linkToRule(l))) || '_none_'
	}) |`;
}).join('\n')}
	
${section('Result Certainty', 3, 'result-certainty')}

| Result Certainty | Description |
| ---------------- | :---------- |
${Object.entries(LintingResultCertainty).map(([name, certainty]) =>
	`| <a id="${certainty}"></a> \`${certainty}\` | ${getDocumentationForType('LintingResultCertainty::' + name, tagTypes.info).replaceAll('\n', ' ')} |`).join('\n')}

${section('R CMD check', 2, 'r-cmd-check')}

Rules tagged ${makeTagBadge(LintingRuleTag.CmdCheck, tagTypes.info)} port \`R CMD check\`, they run by default only for packages (config option \`linter.disabledTags\`).
The [R CMD check conformance](${ConformancePage}) page lists every step of \`R CMD check\`, the rules covering it, and how far they go.

`.trim();
}

/** the page listing every step of R CMD check and the rules covering it */
function getConformancePage(tagTypes: TypeReport): string {
	return `${autoGenHeader({ filename: module.filename, purpose: 'linter' })}

Rules tagged ${makeTagBadge(LintingRuleTag.CmdCheck, tagTypes.info)} port \`R CMD check\` (R 4.6.1, see [Writing R Extensions](${WritingRExtensionsCmdCheck}) and [R Packages](${RPackagesCmdCheck})).
They run by default only for packages (config option \`linter.disabledTags\`), see the [linter](${FlowrWikiBaseRef}/Linter) for all rules.
Below are all steps of \`R CMD check\`, numbered by us (R itself prints them as \`* checking ...\`), each linked to its code in [R's \`check.R\`](${CmdCheckSource}) and its section in R Packages.

| | Coverage |
| :-: | :-- |
| ${ConformanceSymbol.full} | everything the step reports |
| ${ConformanceSymbol.static} | what can be decided without building, installing, or running the package |
| ${ConformanceSymbol.partial} | part of what the step reports |
| ${MoreThanCmdCheck} | flowR reports more than the step, the note says what |

${CmdCheckConformance.map(({ area }) => `${section(area, 3)}

| # | Step (\`checking ...\`) | | Rules | Note |
| --: | :-- | :-: | :-- | :-- |
${numberedConformance().filter(e => e.area === area).map(e =>
	`| <a id="cmd-check-${e.number}"></a>${e.number} | ${cmdCheckStep(e)} | ${cmdCheckCoverage(e)} | ${e.rules.map(r => linkToRule(r)).join(', ')} | ${cmdCheckNote(e)} |`).join('\n')}`).join('\n\n')}
`;
}

async function getRulesPages(knownParser: KnownParser, tagTypes: TypeReport): Promise<Record<string, string>> {
	const rules = registerRules(knownParser, tagTypes.info);
	const result: Record<string, string> = {};

	for(const [name, rule] of rules) {
		const filepath = path.join('wiki', `${getPageNameForLintingRule(name)}.md`);
		result[filepath] = await rule();
	}

	return result;
}

/** Maps file-names to their content, the 'main' file is named 'main' */
async function getTexts(parser: KnownParser, ctx: GeneralDocContext): Promise<Record<string, string> & { main: string }> {
	const tagTypes = getTypesFromFolder({
		rootFolder:  path.resolve('./src/linter/'),
		inlineTypes: mermaidHide
	});

	return {
		'main':                                           await getTextMainPage(parser, tagTypes, ctx),
		...await getRulesPages(parser, tagTypes),
		[path.join('wiki', `${ConformancePageName}.md`)]: getConformancePage(tagTypes)
	};
}

/**
 * https://github.com/flowr-analysis/flowr/wiki/Linter
 */
export class WikiLinter extends DocMaker<'wiki/Linter.md'> {
	constructor() {
		super('wiki/Linter.md', module.filename, 'linter');
	}

	protected async text({ treeSitter, ctx }: DocMakerArgs): Promise<string> {
		const texts = await getTexts(treeSitter, ctx);
		for(const [file, content] of Object.entries(texts)) {
			if(file === 'main') {
				continue; // main is printed below
			}
			this.writeSubFile(file, content);
		}
		return texts['main'];
	}
}
