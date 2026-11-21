import { assertAst, withShell } from '../../../_helper/shell';
import { arg, bin, call, comment, exprList, group, num, sym, un } from '../../../_helper/ast-builder';
import { AssignmentOperators, BinaryOperatorPool, UnaryOperatorPool } from '../../../_helper/provider';
import { label } from '../../../_helper/label';
import { startAndEndsWith } from '../../../../../src/util/text/strings';
import type { RShell } from '../../../../../src/r-bridge/shell';
import { describe } from 'vitest';
import { SourceRange } from '../../../../../src/util/range';
import { BuiltInOperators } from '../../../../../src/dataflow/environments/default-builtin-config/base-operators';
import type { BrandedIdentifier } from '../../../../../src/dataflow/environments/identifier';

/** operators for which the grouping/precedence shapes are pinned (the rest only gets the simple form and the associativity check) */
const PrecedenceRepresentatives = new Set<BrandedIdentifier>(['+', '^', '<-', '&&']);

describe('Parse simple operations', { concurrent: false }, withShell(shell => {
	describe('unary operations', () => {
		for(const op of UnaryOperatorPool) {
			const input = `${op}42`;
			assertAst(label(input, ['unary-operator', 'numbers', ...BuiltInOperators.byName[op].capabilities]),
				shell, input, exprList(un(String(op), [1, 1], num('42', [1, 2 + op.length - 1])))
			);
		}
	});
	describe('? question', () => {
		assertAst(label('? x', ['unary-operator', 'built-in-help', 'name-normal']),
			shell, '? x', exprList(un('?', [1, 1], sym('x', [1, 3])))
		);
	});
	describe('Binary Operations', () => {
		for(const op of [...BinaryOperatorPool].filter(op => !startAndEndsWith(String(op), '%'))) {
			describePrecedenceTestsForOp(op, shell);
		}

		describe('Intermixed with comments', () => {
			assertAst(label('1 + # comment\n2', ['binary-operator', 'infix-calls', 'function-calls', 'numbers', 'comments', 'newlines', ...BuiltInOperators.byName['+'].capabilities]),
				shell, '1 + # comment\n2',
				exprList(bin('+', [1, 3], num('1', [1, 1]), num('2', [2, 1]), [comment('# comment', [1, 5])])),
				{ ignoreAdToks: false }
			);
		});
		describe('Using unknown special infix operator', () => {
			assertAst(label('1 %xx% 2', ['binary-operator', 'infix-calls', 'function-calls', 'numbers', 'special-operator']),
				shell, '1 %xx% 2', exprList({
					...call(sym('%xx%', [1, 3]), [arg(num('1', [1, 1])), arg(num('2', [1, 8]))], { lexeme: '1 %xx% 2' }),
					infixSpecial: true
				})
			);
		});
	});
	describe('Comment Breaks for Unary', () => {
		assertAst(label('Comment Breaks for Unary', ['unary-operator', 'comments', 'newlines', 'name-normal', 'function-calls', ...BuiltInOperators.byName['~'].capabilities]),
			shell, 'res <- func(~ # comment\n     var)',
			exprList(bin('<-', [1, 5], sym('res', [1, 1]), call(sym('func', [1, 8]), [
				arg(un('~', [1, 13], sym('var', [2, 6]), [comment('# comment', [1, 15])]), undefined,
					{ lexeme: '~ # comment\n     var', location: SourceRange.from(1, 13, 2, 8) })
			])))
		);
	});
}));

function describePrecedenceTestsForOp(op: BrandedIdentifier, shell: RShell): void {
	const comparisonPrecedenceOperators = new Set<BrandedIdentifier>(['<', '<=', '>', '>=', '==', '!=', '', '==']);

	describe(`${op}`, () => {
		const simpleInput = `1 ${op} 1`;
		const k = op.length - 1;
		const caps = BuiltInOperators.byName[op].capabilities;
		const one = (col: number) => num('1', [1, col]);
		assertAst(label(simpleInput, ['binary-operator', 'infix-calls', 'function-calls', 'numbers', ...caps]),
			shell, simpleInput, exprList(bin(String(op), [1, 3], one(1), one(5 + k)))
		);
		if(comparisonPrecedenceOperators.has(op)) {
			return;
		}
		const labels = (name: string) => label(name, ['binary-operator', 'infix-calls', 'function-calls', 'numbers', 'grouping', ...caps]);

		// exponentiation and assignments have a different behavior when nested without parenthesis
		if(op !== '^' && op !== '**' && !AssignmentOperators.includes(op)) {
			assertAst(labels('No Parenthesis'), shell, `1 ${op} 1 ${op} 42`,
				exprList(bin(String(op), [1, 7 + k], bin(String(op), [1, 3], one(1), one(5 + k)), num('42', [1, 9 + 2 * k]))),
				{ ignoreAdToks: true });
		}
		if(!PrecedenceRepresentatives.has(op)) {
			return;
		}
		const left = group('(', [1, 1], [1, 7 + k], bin(String(op), [1, 4], one(2), one(6 + k)));
		assertAst(labels('Single Parenthesis'), shell, `(1 ${op} 1) ${op} 42`,
			exprList(bin(String(op), [1, 9 + k], left, num('42', [1, 11 + 2 * k]))), { ignoreAdToks: true });
		assertAst(labels('Multiple Parenthesis'), shell, `(1 ${op} 1) ${op} (42)`,
			exprList(bin(String(op), [1, 9 + k], left, group('(', [1, 11 + 2 * k], [1, 14 + 2 * k], num('42', [1, 12 + 2 * k])))), { ignoreAdToks: true });
		assertAst(labels('Invert precedence'), shell, `1 ${op} (1 ${op} 42)`,
			exprList(bin(String(op), [1, 3], one(1), group('(', [1, 5 + k], [1, 12 + 2 * k], bin(String(op), [1, 8 + k], one(6 + k), num('42', [1, 10 + 2 * k]))))),
			{ ignoreAdToks: true });
	});
}
