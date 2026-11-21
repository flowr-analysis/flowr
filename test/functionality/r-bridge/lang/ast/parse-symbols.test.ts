import { assertAst, withShell } from '../../../_helper/shell';
import { exprList, sym } from '../../../_helper/ast-builder';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';

// plain and namespaced symbols are pinned by the value tests
describe('Parse symbols', { concurrent: false }, withShell(shell => {
	assertAst(label('With Quotes and Namespace', ['name-normal', 'name-quoted', 'accessing-exported-names']),
		shell, 'a::"b"', exprList(sym('"b"', [1, 4], Identifier.make('"b"', 'a')))
	);
}));
