import { assertAst, withShell } from '../../../_helper/shell';
import { exprList, group, num, sym } from '../../../_helper/ast-builder';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';

describe('Parse expression lists', { concurrent: false }, withShell(shell => {
	describe('Expression lists with newlines and braces', () => {
		// expr list is the default top-level token for R
		assertAst(label('single element', ['numbers']), shell, '42', exprList(num('42', [1, 1])));
		// the r standard does not seem to allow '\r\n' or '\n\r'
		assertAst(label('two lines', ['name-normal', 'numbers', 'newlines']),
			shell, '42\na', exprList(num('42', [1, 1]), sym('a', [2, 1])));
		assertAst(label('many lines', ['name-normal', 'numbers', 'newlines']),
			shell, 'a\nb\nc\nd\nn2\nz\n', exprList(sym('a', [1, 1]), sym('b', [2, 1]), sym('c', [3, 1]), sym('d', [4, 1]), sym('n2', [5, 1]), sym('z', [6, 1])));
		assertAst(label('Two Lines With Braces', ['name-normal', 'numbers', 'grouping', 'newlines']),
			shell, '{ 42\na }', exprList(group('{', [1, 1], [2, 3], num('42', [1, 3]), sym('a', [2, 1]))));
		// { 42\na }{ x } seems to be illegal for R...
		assertAst(label('Multiple Braces', ['name-normal', 'numbers', 'grouping', 'newlines']),
			shell, '{ 42\na }\n{ x }', exprList(
				group('{', [1, 1], [2, 3], num('42', [1, 3]), sym('a', [2, 1])),
				group('{', [3, 1], [3, 5], sym('x', [3, 3]))
			));
	});

	describe('Expression lists with semicolons', () => {
		assertAst(label('Two Elements in Same Line', ['numbers', 'name-normal', 'semicolons']),
			shell, '42;a', exprList(num('42', [1, 1]), sym('a', [1, 4])));
		assertAst(label('Empty split with semicolon', ['numbers', 'semicolons', 'grouping']),
			shell, '{ 3; }', exprList(group('{', [1, 1], [1, 6], num('3', [1, 3]))));
		assertAst(label('Inconsistent split with semicolon', ['numbers', 'semicolons', 'newlines']),
			shell, '1\n2; 3\n4', exprList(num('1', [1, 1]), num('2', [2, 1]), num('3', [2, 4]), num('4', [3, 1])));
	});
}));
