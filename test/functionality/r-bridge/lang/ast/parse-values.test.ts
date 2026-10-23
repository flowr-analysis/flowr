import { assertAst, withShell } from '../../../_helper/shell';
import { RNumberPool, RStringPool, RSymbolPool } from '../../../_helper/provider';
import { comment, exprList, lgl, num, str, sym } from '../../../_helper/ast-builder';
import { MIN_VERSION_RAW_STABLE } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions';
import { prepareParsedData } from '../../../../../src/r-bridge/lang-4.x/ast/parser/json/format';
import { label } from '../../../_helper/label';
import { retrieveParseDataFromRCode } from '../../../../../src/r-bridge/retriever';
import { describe, assert, test, expect } from 'vitest';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';

describe('CSV parsing', { concurrent: false }, withShell(shell => {
	test('simple', async() => {
		const code = await retrieveParseDataFromRCode({
			request: 'text',
			content: 'x <- 1'
		}, shell);
		assert.equal(code, '[1,1,1,6,7,0,"expr",false,"x <- 1"],[1,1,1,1,1,3,"SYMBOL",true,"x"],[1,1,1,1,3,7,"expr",false,"x"],[1,3,1,4,2,7,"LEFT_ASSIGN",true,"<-"],[1,6,1,6,4,5,"NUM_CONST",true,"1"],[1,6,1,6,5,7,"expr",false,"1"]');
	});

	test('to object', async() => {
		const code = await retrieveParseDataFromRCode({
			request: 'text',
			content: 'x <- 1'
		}, shell);
		const parsed = prepareParsedData(code);
		const one = { 'line1': 1, 'col1': 1, 'line2': 1, 'col2': 1, 'id': 1, 'parent': 3, 'token': 'SYMBOL', 'terminal': true, 'text': 'x' };
		const two = { 'line1': 1, 'col1': 3, 'line2': 1, 'col2': 4, 'id': 2, 'parent': 7, 'token': 'LEFT_ASSIGN', 'terminal': true, 'text': '<-' };
		const three = { 'line1': 1, 'col1': 1, 'line2': 1, 'col2': 1, 'id': 3, 'parent': 7, 'token': 'expr', 'terminal': false, 'text': 'x', 'children': [one] };
		const four = { 'line1': 1, 'col1': 6, 'line2': 1, 'col2': 6, 'id': 4, 'parent': 5, 'token': 'NUM_CONST', 'terminal': true, 'text': '1' };
		const five = { 'line1': 1, 'col1': 6, 'line2': 1, 'col2': 6, 'id': 5, 'parent': 7, 'token': 'expr', 'terminal': false, 'text': '1', 'children': [four] };
		assert.deepEqual(parsed, [{ 'line1': 1, 'col1': 1, 'line2': 1, 'col2': 6, 'id': 7, 'parent': 0, 'token': 'expr', 'terminal': false, 'text': 'x <- 1', 'children': [three, two, five] }]);
	});


	test('multiline to object', async() => {
		const code = await retrieveParseDataFromRCode({
			request: 'text',
			content: '5\nb'
		}, shell);
		const parsed = prepareParsedData(code);
		const one = { 'line1': 1, 'col1': 1, 'line2': 1, 'col2': 1, 'id': 1, 'parent': 2, 'token': 'NUM_CONST', 'terminal': true, 'text': '5' };
		const exprOne = { 'line1': 1, 'col1': 1, 'line2': 1, 'col2': 1, 'id': 2, 'parent': 0, 'token': 'expr', 'terminal': false, 'text': '5', 'children': [one] };
		const two = { 'line1': 2, 'col1': 1, 'line2': 2, 'col2': 1, 'id': 6, 'parent': 8, 'token': 'SYMBOL', 'terminal': true, 'text': 'b' };
		const exprTwo = { 'line1': 2, 'col1': 1, 'line2': 2, 'col2': 1, 'id': 8, 'parent': 0, 'token': 'expr', 'terminal': false, 'text': 'b', 'children': [two] };
		assert.deepEqual(parsed, [exprOne, exprTwo]);
	});
}));

// same lexer path as a sibling that stays in the pool: other digits, further simple escapes, the other quote or bracket for the same shape
const RedundantNumbers: ReadonlySet<string> = new Set(['10', '0.2', '1000000L', '1.1L', '4.1i', '0x1.1P1', '0x.p-5']);
const RedundantStrings: ReadonlySet<string> = new Set(["'a'", "'Hi'", '"a#b"', '"\\r"', '"\\t"', '"\\b"', '"\\a"', '"\\f"', '"\\v"', '"\\uAFFE"', '"\\U{10AFFE}"', "r'()'", 'r"[xx]"', 'r"{xx}"']);

describe('Constant Parsing', { concurrent: false }, withShell(shell => {
	describe('parse empty', () => {
		assertAst(label('nothing', []),
			shell, '', exprList()
		);
	});
	describe('parse single', () => {
		test('parse illegal', async() =>
			await expect(retrieveParseDataFromRCode({
				request: 'text',
				content: '{'
			}, shell)).rejects.toThrow()
		);
		describe('numbers', () => {
			for(const number of RNumberPool.filter(n => !RedundantNumbers.has(n.str))) {
				assertAst(label(number.str, ['numbers', ...(number.val.complexNumber ? ['numbers-complex' as const] : [])]),
					shell, number.str, exprList(num(number.str, [1, 1], number.val)), {
						// https://github.com/r-lib/tree-sitter-r/issues/159
						skipTreeSitter: /[pP]/.test(number.str)
					}
				);
			}
		});
		describe('strings', () => {
			for(const string of RStringPool.filter(s => !RedundantStrings.has(s.str))) {
				const raw = string.str.startsWith('r') || string.str.startsWith('R');
				assertAst(label(string.str, ['strings', ...(raw ? ['raw-strings' as const] : [])]),
					shell, string.str, exprList({ ...str(string.str, [1, 1], string.val.str), content: string.val }),
					{
						// just a hacky way to not outright flag all
						minRVersion: raw ? MIN_VERSION_RAW_STABLE : undefined
					}
				);
			}
		});
		describe('Symbols', () => {
			for(const symbol of RSymbolPool) {
				const mapped = symbol.namespace !== undefined && !symbol.internal ? ['accessing-exported-names' as const] : [];
				assertAst(label(symbol.str, ['name-normal', ...mapped]),
					shell, symbol.str, exprList(sym(symbol.val, [1, symbol.symbolStart], Identifier.make(symbol.val, symbol.namespace, symbol.internal)))
				);
			}
		});
		describe('logical', () => {
			for(const lexeme of ['TRUE', 'FALSE'] as const) {
				assertAst(label(`${lexeme} as ${JSON.stringify(lexeme === 'TRUE')}`, ['logical']), shell, lexeme, exprList(lgl(lexeme, [1, 1])));
			}
		});
		describe('comments', () => {
			assertAst(label('simple line comment', ['comments']),
				shell, '# Hello World', { ...exprList(), info: { adToks: [comment('# Hello World', [1, 1])] } }
			);
		});
	});
})
);
