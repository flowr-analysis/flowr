import { beforeAll, describe, expect, test } from 'vitest';
import { DefaultNormalizedAstFold } from '../../../src/abstract-interpretation/normalized-ast-fold';
import { retrieveNormalizedAst, withShell } from '../_helper/shell';
import type { RString } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RNumber } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { NormalizedAst } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';

describe('normalize-visitor', withShell(shell => {
	let normalized: NormalizedAst | undefined;
	beforeAll(async() => {
		normalized = await retrieveNormalizedAst(shell, 'x <- 42\ny <- "hello world"\nprint("foo")');
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
		astFold.fold(normalized?.ast);
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
		const result = astFold.fold(normalized?.ast);
		expect(result).toBe(2);
	});
}));
