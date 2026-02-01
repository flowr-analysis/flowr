import { assertAst, withShell } from '../../../_helper/shell';
import { exprList } from '../../../_helper/ast-builder';
import { rangeFrom } from '../../../../../src/util/range';
import { label } from '../../../_helper/label';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import { describe } from 'vitest';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';

describe.sequential('Parse symbols', withShell(shell => {
	assertAst(label('Simple Symbol', ['name-normal']),
		shell, 'a', exprList({
			type:     RType.Symbol,
			location: rangeFrom(1, 1, 1, 1),
			lexeme:   'a',
			content:  'a',
			info:     {}
		})
	);
	assertAst(label('With Namespace', ['name-normal', 'accessing-exported-names']),
		shell, 'a::b', exprList({
			type:     RType.Symbol,
			location: rangeFrom(1, 4, 1, 4),
			lexeme:   'b',
			content:  Identifier.make('b', 'a'),
			info:     {}
		})
	);
	assertAst(label('With Quotes and Namespace', ['name-normal', 'name-quoted', 'accessing-exported-names']),
		shell, 'a::"b"', exprList({
			type:     RType.Symbol,
			location: rangeFrom(1, 4, 1, 6),
			lexeme:   '"b"',
			content:  Identifier.make('"b"', 'a'),
			info:     {}
		})
	);
}));

