import { assertAst, sameForSteps, withShell } from '../../../_helper/shell'
import { exprList } from '../../../_helper/ast-builder'
import { rangeFrom } from '../../../../../src/util/range'
import { RType } from '../../../../../src'
import { DESUGAR_NORMALIZE, NORMALIZE } from '../../../../../src/core/steps/all/core/10-normalize'
import { label } from '../../../_helper/label'

describe('Parse symbols', withShell(shell => {
	assertAst(label('Simple Symbol', ['name-normal']),
		shell, 'a',
		sameForSteps([NORMALIZE, DESUGAR_NORMALIZE],
			exprList({
				type:      RType.Symbol,
				location:  rangeFrom(1, 1, 1, 1),
				namespace: undefined,
				lexeme:    'a',
				content:   'a',
				info:      {}
			}))
	)
	assertAst(label('With Namespace', ['name-normal', 'accessing-exported-names']),
		shell, 'a::b',
		sameForSteps([NORMALIZE, DESUGAR_NORMALIZE],
			exprList({
				type:      RType.Symbol,
				location:  rangeFrom(1, 4, 1, 4),
				namespace: 'a',
				lexeme:    'b',
				content:   'b',
				info:      {}
			}))
	)
	assertAst(label('With Quotes and Namespace', ['name-normal', 'name-quoted', 'accessing-exported-names']),
		shell, 'a::"b"',
		sameForSteps([NORMALIZE, DESUGAR_NORMALIZE],
			exprList({
				type:      RType.Symbol,
				location:  rangeFrom(1, 4, 1, 6),
				namespace: 'a',
				lexeme:    '"b"',
				content:   '"b"',
				info:      {}
			}))
	)
}))

