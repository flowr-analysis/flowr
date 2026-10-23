import { assertAst, withShell } from '../../../_helper/shell';
import { bin, exprList, group, num, str, sym } from '../../../_helper/ast-builder';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe } from 'vitest';

// the plain `x <op> 5` form for every assignment operator is pinned by the binary operator tests
describe('Parse simple assignments', { concurrent: false }, withShell(shell => {
	// allow assignments to strings and function calls
	describe('Assignments to strings', () => {
		assertAst(label('Assign to Given String', ['binary-operator', 'infix-calls', 'function-calls', ...OperatorDatabase['<-'].capabilities, 'name-quoted', 'numbers']),
			shell, '\'a\' <- 5', exprList(bin('<-', [1, 5], str("'a'", [1, 1], 'a'), num('5', [1, 8])))
		);
	});

	describe('Assignment with an expression list', () => {
		assertAst(label('x <- { 2 * 3 }', [...OperatorDatabase['*'].capabilities, 'function-calls', ...OperatorDatabase['<-'].capabilities, 'name-normal', 'numbers', 'grouping']),
			shell, 'x <- { 2 * 3 }', exprList(bin('<-', [1, 3], sym('x', [1, 1]),
				group('{', [1, 6], [1, 14], bin('*', [1, 10], num('2', [1, 8]), num('3', [1, 12]))))),
			{ ignoreAdToks: true }
		);
	});
}));
