import { beforeAll, describe, expect, test } from 'vitest';
import { DefaultNormalizedAstFold } from '../../../src/abstract-interpretation/normalized-ast-fold';
import { retrieveNormalizedAst, withShell } from '../_helper/shell';
import type { RString } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RNumber } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { NormalizedAst } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RExpressionList } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { MyMathFold } from '../../../src/documentation';

describe.sequential('normalize-visitor', withShell(shell => {
	let normalized: NormalizedAst | undefined;
	let mathAst: NormalizedAst | undefined;
	beforeAll(async() => {
		normalized = await retrieveNormalizedAst(shell, 'x <- 42\ny <- "hello world"\nprint("foo")');
		mathAst = await retrieveNormalizedAst(shell, '1 + 3 * 2');

	});
	test('find the number', () => {
		let marker = false;
		class MyNumberFold<Info> extends DefaultNormalizedAstFold<void, Info> {
			override foldRNumber(node: RNumber<Info>) {
				super.foldRNumber(node);
				marker = true;
			}
		}
		const astFold = new MyNumberFold();
		astFold.fold(normalized?.ast.files[0].root);
		expect(marker).toBe(true);
	});
	test('find the number of strings within my program (monoid)', () => {
		class MyStringFold<Info> extends DefaultNormalizedAstFold<number, Info> {
			constructor() {
				super(0);
			}

			protected concat(a: number, b: number): number {
				return a + b;
			}

			override foldRString(_node: RString<Info>) {
				return 1;
			}
		}
		const astFold = new MyStringFold();
		const result = astFold.fold(normalized?.ast.files[0].root);
		expect(result).toBe(2);
	});
	test('do basic math (monoid)', () => {
		const astFold = new MyMathFold();
		const result = astFold.fold(mathAst?.ast.files[0].root);
		expect(result).toBe(7);
	});
	test('fold should stop if overwritten and no continue', () => {
		let foundNumber = false;
		class MyMathFold<Info> extends DefaultNormalizedAstFold<void, Info> {
			override foldRNumber(_node: RNumber<Info>) {
				foundNumber = true;
			}

			override foldRExpressionList(_node: RExpressionList<Info>) {

			}
		}
		const astFold = new MyMathFold();
		astFold.fold(mathAst?.ast.files[0].root);
		expect(foundNumber).toBe(false);
	});
}));
