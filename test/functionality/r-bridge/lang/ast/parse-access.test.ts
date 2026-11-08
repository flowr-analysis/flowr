import { assertAst, withShell } from '../../../_helper/shell';
import { access, arg, bin, comment, exprList, num, sym } from '../../../_helper/ast-builder';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { EmptyArgument } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { describe } from 'vitest';
import { SourceRange } from '../../../../../src/util/range';

describe('Parse value access', { concurrent: false }, withShell(shell => {
	describe('Single bracket', () => {
		const a = sym('a', [1, 1]);
		assertAst(label('Empty Access', ['name-normal', 'single-bracket-access', 'access-with-empty']),
			shell, 'a[]', exprList(access('[', [1, 2], a, []))
		);
		assertAst(label('One Constant', ['name-normal', 'single-bracket-access', 'numbers']),
			shell, 'a[1]', exprList(access('[', [1, 2], a, [arg(num('1', [1, 3]))]))
		);
		assertAst(label('One Variable', ['name-normal', 'single-bracket-access']),
			shell, 'a[x]', exprList(access('[', [1, 2], a, [arg(sym('x', [1, 3]))]))
		);
		assertAst(label('One Expression', ['name-normal', 'single-bracket-access', 'binary-operator', 'infix-calls', 'function-calls', 'numbers', ...OperatorDatabase['-'].capabilities]),
			shell, 'a[x + 3]', exprList(access('[', [1, 2], a, [
				arg(bin('+', [1, 5], sym('x', [1, 3]), num('3', [1, 7])), undefined, { lexeme: 'x + 3', location: SourceRange.from(1, 3, 1, 7) })
			]))
		);
		assertAst(label('Multiple Access with Comments', ['name-normal', 'single-bracket-access', 'numbers', 'comments']),
			shell, 'a[3, # comment\n2]', exprList(access('[', [1, 2], a, [
				arg(num('3', [1, 3])), arg(num('2', [2, 1]))
			], [comment('# comment', [1, 6])]))
		);
		assertAst(label('Multiple with Empty', ['name-normal', 'single-bracket-access', 'numbers', 'access-with-empty']),
			shell, 'a[,2,4]', exprList(access('[', [1, 2], a, [EmptyArgument, arg(num('2', [1, 4])), arg(num('4', [1, 6]))]))
		);
		assertAst(label('Named argument', ['name-normal', 'single-bracket-access', 'numbers', 'access-with-argument-names']),
			shell, 'a[1,super=4]', exprList(access('[', [1, 2], a, [arg(num('1', [1, 3])), arg(num('4', [1, 11]), sym('super', [1, 5]))]))
		);
		assertAst(label('Chained', ['name-normal', 'single-bracket-access', 'numbers']),
			shell, 'a[1][4]', exprList(access('[', [1, 5], access('[', [1, 2], a, [arg(num('1', [1, 3]))]), [arg(num('4', [1, 6]))]))
		);
	});
	describe('Double bracket', () => {
		const b = sym('b', [1, 1]);
		assertAst(label('Empty', ['name-normal', 'double-bracket-access', 'access-with-empty']),
			shell, 'b[[]]', exprList(access('[[', [1, 2], b, []))
		);
		assertAst(label('Multiple with empty', ['name-normal', 'double-bracket-access', 'numbers', 'access-with-empty']),
			shell, 'b[[5,,]]', exprList(access('[[', [1, 2], b, [arg(num('5', [1, 4])), EmptyArgument, EmptyArgument]))
		);
		assertAst(label('Multiple', ['name-normal', 'double-bracket-access', 'numbers']),
			shell, 'b[[5,3]]', exprList(access('[[', [1, 2], b, [arg(num('5', [1, 4])), arg(num('3', [1, 6]))]))
		);
	});
	describe('Dollar and Slot', () => {
		assertAst(label('Dollar access', ['name-normal', 'dollar-access']),
			shell, 'c$x', exprList(access('$', [1, 2], sym('c', [1, 1]), [arg(sym('x', [1, 3]))]))
		);
		assertAst(label('Nested Access', ['name-normal', 'dollar-access']),
			shell, 'c$x$y', exprList(access('$', [1, 4], access('$', [1, 2], sym('c', [1, 1]), [arg(sym('x', [1, 3]))]), [arg(sym('y', [1, 5]))]))
		);
		assertAst(label('Slot based access', ['name-normal', 'slot-access']),
			shell, 'd@y', exprList(access('@', [1, 2], sym('d', [1, 1]), [arg(sym('y', [1, 3]))]))
		);
	});
}));
