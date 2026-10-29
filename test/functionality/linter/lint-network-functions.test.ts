import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, controlledSigDb, assertLintedLines, assertLinterFields } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { decorateLabelContext, label } from '../_helper/label';

const urlPrefix = ['https://', 'ftp://', 'ftps://'];

describe('flowR linter', withTreeSitter(parser => {
	describe('network functions', () => {
		/* Testing the nested use the 'url' function in other function calls */
		assertLinter('network function nested', parser, 'foo(url("http://example.com"))',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'base::url', loc: [1, 5, 1, 29] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);
		for(const prefix of urlPrefix) {
			assertLinter(`network function with url prefix: ${prefix}`, parser, `read.csv("${prefix}www.example.com")`,
				'network-functions',
				[
					{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 1, 1, prefix.length + 27] }
				],
				{ totalCalls: 1, totalFunctionDefinitions: 1 }
			);

			assertLinter(`network funcion with multiple arguments: ${prefix}`, parser, `download.file("${prefix}foo.org/bar.csv", "local.csv")`,
				'network-functions',
				[
					{ certainty: LintingResultCertainty.Certain, function: 'utils::download.file', loc: [1, 1, 1, prefix.length + 45] }
				],
				{ totalCalls: 1, totalFunctionDefinitions: 1 }
			);

		}

		assertLinter('a file name built from the numbers of a loop is local', parser, 'for(i in 2000:2002) x <- read.csv(paste0(i, ".csv"))', 'network-functions', []);
		assertLinter('a file name built from the strings of a loop is local', parser, 'for(i in c("a", "b")) x <- read.csv(paste0(i, ".csv"))', 'network-functions', []);
		assertLinter('an address built from the strings of a loop is found', parser, 'for(h in c("a", "b")) x <- read.csv(paste0("https://", h, ".org"))', 'network-functions',
			[{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 28, 1, 66] }]);
		assertLinter('a local data source of an attached package', parser, 'library(rgdal)\nx <- readOGR("coastpolygon", "coastpolygon")', 'network-functions', []);
		assertLinter('rvest selectors work on a parsed document', parser, 'library(rvest)\nhtml_text(html_nodes(doc, "a"))', 'network-functions', []);
		assertLinter('rvest still fetches a constant URL it is handed to parse', parser, 'library(rvest)\nhtml_text(html_nodes(read_html("https://x.org"), "a"))', 'network-functions',
			[{ certainty: LintingResultCertainty.Certain, function: 'read_html', loc: [2, 22, 2, 47] }]);
		assertLinter('native pipe', parser, '"https://x.org/a.csv" |> read.csv()', 'network-functions',
			[{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 26, 1, 35] }]);

		assertLinter('library call', parser, 'library(httr)\nPOST("http://example.com")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'httr::POST', loc: [2, 1, 2, 26] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ sigDb: controlledSigDb('httr', ['GET', 'POST']) }
		);
		assertLinter('unloaded library call', parser, 'POST("http://example.com")',
			'network-functions',
			[{ certainty: LintingResultCertainty.Certain, function: 'POST', loc: [1, 1, 1, 26] }],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
		);
		assertLinter('mismatched library call', parser, 'httr2::GET("http://example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 }
		);
		assertLinter('namespace call', parser, 'library(httr)\nhttr::GET("http://example.com")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'httr::GET', loc: [2, 1, 2, 31] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ sigDb: controlledSigDb('httr', ['GET', 'POST']) }
		);

		assertLinter('do not trigger without url prefix', parser, 'read.csv("www.example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 }
		);
		assertLinter('trigger with custom url prefix', parser, 'read.csv("www.example.com")',
			'network-functions',
			[{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 1, 1, 27] }],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: [{ name: Identifier.make('read.csv', 'utils'), onlyTriggerWithArgument: /^www\./ }] }
		);
		assertLinter('do not trigger with custom url prefix', parser, 'read.csv("https://example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
			{ fns: [{ name: Identifier.make('read.csv', 'utils'), onlyTriggerWithArgument: /^www\./ }] }
		);

		assertLinter('do not trigger with multiple arguments', parser, 'download.file("data/local.csv", "local.csv")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 }
		);

		assertLinter('not in list test', parser, 'file("data/local.csv")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
		);

		assertLinter('nor in list but prefix in string', parser, 'print("http://example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
		);

		assertLinter('do not trigger on known source', parser, 'source("tex.R")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
		);

		assertLinter('trigger on web source', parser, 'source("https://foo.com")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'base::source', loc: [1, 1, 1, 25] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
		);


		assertLinter('Named argument', parser, 'read.csv(file = "http://example.com/data.csv")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 1, 1, 46] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);

		assertLinter('Positional argument with custom config', parser, 'test.me(x, "http://example.com/data.csv")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'test.me', loc: [1, 1, 1, 41] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: [{ name: 'test.me', onlyTriggerWithArgument: /^(https?|ftps?):\/\//, info: { argIdx: 1 } }] }
		);
		assertLinter('Named argument with custom config', parser, 'test.me(foo = "http://example.com/data.csv")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'test.me', loc: [1, 1, 1, 44] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: [{ name: 'test.me', onlyTriggerWithArgument: /^(https?|ftps?):\/\//, info: { argName: 'foo' } }] }
		);

		assertLinter('Resolve value', parser, 'url <- "http://example.com/data.csv"; read.csv(url)',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 39, 1, 51] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);

		describe('a call resolved via a loaded package is still flagged', () => {
			// regression: the loaded-package export must still count as a built-in call target
			assertLinter('with a (controlled) package database', parser, 'library(httr)\nGET("http://example.com")',
				'network-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'httr::GET', loc: [2, 1, 2, 25] }],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ sigDb: controlledSigDb('httr', ['GET', 'POST']) }
			);
			assertLinter('without any package database', parser, 'library(httr)\nGET("http://example.com")',
				'network-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'GET', loc: [2, 1, 2, 25] }],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ noSigDb: true }
			);
		});

		describe('a call that writes no file argument writes to the console', () => {
			assertLinter('cat without file', parser, 'cat("hello\n")', 'network-functions', [], { totalCalls: 0, totalFunctionDefinitions: 0 });
			assertLinter('writeLines without con', parser, 'writeLines("x")', 'network-functions', [], { totalCalls: 0, totalFunctionDefinitions: 0 });
			assertLinter('cat with an unknown value where its file may go', parser, 'cat("n: ", length(x))', 'network-functions', [], { totalCalls: 0, totalFunctionDefinitions: 0 });
			assertLinter('cat to a local file', parser, 'cat("hello", file = "out.txt")', 'network-functions', [], { totalCalls: 0, totalFunctionDefinitions: 0 });
			/* R opens urls for reading only, so writing to one fails before it reaches the network */
			assertLinter('cat to a url', parser, 'cat("hello", file = "https://example.com")', 'network-functions', [], { totalCalls: 0, totalFunctionDefinitions: 0 });
			assertLinter('a device writing to a name the user gives', parser, 'name <- readline("File: ")\npdf(name)', 'network-functions', [], { totalCalls: 0, totalFunctionDefinitions: 0 });
		});
	});
	assertLinterFields(parser, '"https://x.org/a.csv" |> read.csv()', 'network-functions', [{ function: 'utils::read.csv' }]);
	assertLinterFields(parser, 'socketConnection(host = "x.org", port = 80)', 'network-functions', [{ function: 'base::socketConnection', certainty: LintingResultCertainty.Certain }]);
	assertLinterFields(parser, 'd <- download.file\nd("https://x.org", "a")', 'network-functions', [{ function: 'utils::download.file', certainty: LintingResultCertainty.Certain }]);
	assertLinterFields(parser, 'purrr::walk(c("https://a.org"), download.file, destfile = "x")', 'network-functions', [{ function: 'utils::download.file', certainty: LintingResultCertainty.Certain }]);
	assertLinterFields(parser, 'curl::curl_download("sftp://x.org/a", "a")', 'network-functions', [{ function: 'curl::curl_download', certainty: LintingResultCertainty.Certain }]);
	assertLinterFields(parser, 'req <- httr2::request("https://x.org")\nhttr2::req_perform(req)', 'network-functions', [{ function: 'httr2::req_perform', loc: [2, 1, 2, 23] }]);
	assertLinterFields(parser, 'jsonlite::fromJSON("https://x.org/a.json")', 'network-functions', [{ function: 'jsonlite::fromJSON' }]);
	assertLintedLines('a command is no address', parser, 'pipe(paste("cat", readline()))', 'network-functions', []);
	assertLintedLines('a connection to text in memory is no address', parser, 'x <- readline()\nsource(textConnection(x))', 'network-functions', []);
	assertLintedLines(decorateLabelContext(label('security: a device file is no network address', ['name-normal', 'function-calls']), ['dataflow']), parser, 'name <- readline("File for the plot: ")\npdf(name)\nplot(1:10)\ndev.off()', 'network-functions', []);
}));
