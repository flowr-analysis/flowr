import { bin, exprList, group, num, sym } from '../../../_helper/ast-builder';
import { assertAst, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import { describe } from 'vitest';
import { SourceRange } from '../../../../../src/util/range';

describe('Parse Larger Snippets', { concurrent: false }, withShell(shell => {
	describe('if-then, assignments, symbols, and comparisons', () => {
		assertAst(label('Manual Max Function', [
			'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['='].capabilities, ...OperatorDatabase['->'].capabilities, ...OperatorDatabase['<<-'].capabilities, ...OperatorDatabase['->>'].capabilities, 'numbers', 'if', ...OperatorDatabase['>'].capabilities, 'grouping', 'newlines'
		]), shell,
		`
a <- 3
b = 4
if (a >b) {
  max <<- a
  i ->2
} else {
  b ->> max
}
max
    `, exprList(
			bin('<-', [2, 3], sym('a', [2, 1]), num('3', [2, 6])),
			bin('=', [3, 3], sym('b', [3, 1]), num('4', [3, 5])),
			{
				type:      RType.IfThenElse,
				lexeme:    'if',
				location:  SourceRange.from(4, 1, 4, 2),
				info:      {},
				condition: bin('>', [4, 7], sym('a', [4, 5]), sym('b', [4, 8])),
				then:      group('{', [4, 11], [7, 1],
					bin('<<-', [5, 7], sym('max', [5, 3]), sym('a', [5, 11])),
					bin('->', [6, 5], sym('i', [6, 3]), num('2', [6, 7]))
				),
				otherwise: group('{', [7, 8], [9, 1], bin('->>', [8, 5], sym('b', [8, 3]), sym('max', [8, 9])))
			},
			sym('max', [10, 1])
		), { ignoreAdToks: true });
	});
}));
