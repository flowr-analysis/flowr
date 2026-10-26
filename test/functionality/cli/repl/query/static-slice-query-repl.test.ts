import { assert, describe, test } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertCriteriaReplParser, assertReplParser, discardingReplOutput } from '../../../_helper/repl';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { replProcessAnswer } from '../../../../../src/cli/repl/core';
import { voidFormatter } from '../../../../../src/util/text/ansi';
import { label } from '../../../_helper/label';
import { SliceDirection } from '../../../../../src/util/slice-direction';

describe('Static Slice Query REPL Parser', () => {
	const parser = SupportedQueries['static-slice'].fromLine;
	assertCriteriaReplParser(parser, criteria => [{ type: 'static-slice', criteria: [...criteria], direction: SliceDirection.Backward }]);
	assertReplParser({ parser,
		label:         'with direction',
		line:          ['(1@var;1:5)f'],
		expectedParse: {
			query: [{
				type:      'static-slice',
				criteria:  ['1@var', '1:5'],
				direction: SliceDirection.Forward
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'with direction and code',
		line:          ['(1@var)f', 'someCode'],
		expectedParse: {
			query: [{
				type:      'static-slice',
				criteria:  ['1@var'],
				direction: SliceDirection.Forward
			}],
			rCode: 'someCode',
		},
	});
	assertReplParser({ parser,
		label:         'with inline flag',
		line:          ['(3@print)i'],
		expectedParse: {
			query: [{
				type:          'static-slice',
				criteria:      ['3@print'],
				direction:     SliceDirection.Backward,
				inlineSources: true
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'forward slice with inline flag',
		line:          ['(1@var)fi', 'someCode'],
		expectedParse: {
			query: [{
				type:          'static-slice',
				criteria:      ['1@var'],
				direction:     SliceDirection.Forward,
				inlineSources: true
			}],
			rCode: 'someCode',
		},
	});
	assertReplParser({ parser,
		label:         'inline flag before direction',
		line:          ['(1@var)if'],
		expectedParse: {
			query: [{
				type:          'static-slice',
				criteria:      ['1@var'],
				direction:     SliceDirection.Forward,
				inlineSources: true
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'with include-callees flag',
		line:          ['(3@print)c'],
		expectedParse: {
			query: [{
				type:           'static-slice',
				criteria:       ['3@print'],
				direction:      SliceDirection.Backward,
				includeCallees: true
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'include-callees flag combined with inline and direction',
		line:          ['(1@var)fic', 'someCode'],
		expectedParse: {
			query: [{
				type:           'static-slice',
				criteria:       ['1@var'],
				direction:      SliceDirection.Forward,
				inlineSources:  true,
				includeCallees: true
			}],
			rCode: 'someCode',
		},
	});
});

describe('Static Slice Query in the REPL', () => {
	async function sliced(line: string): Promise<string[]> {
		const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
		const out: string[] = [];
		await replProcessAnswer(analyzer, { ...discardingReplOutput, formatter: voidFormatter, stdout: s => out.push(...s.split('\n')) }, line, false);
		return out;
	}
	test(label('quoted code undoes its escapes, as the code commands read it', ['name-normal', 'newlines'], ['other']), async() => {
		assert.deepStrictEqual((await sliced(':query @static-slice (2@y) "x <- \\"a\\"\\ny <- x"')).slice(0, 2), ['x <- "a"', 'y <- x']);
	});
	test(label('an escape JSON does not know keeps the code as written', ['name-normal', 'strings'], ['other']), async() => {
		assert.deepStrictEqual((await sliced(':query @static-slice (1@x) "x <- \'\\d\'"'))[0], 'x <- \'\\d\'');
	});
	test(label('the result is printed with the formatter of the output', ['name-normal'], ['other']), async() => {
		assert.notInclude((await sliced(':query @static-slice (1@x) x <- 1')).join('\n'), '\u001b[');
	});
});
