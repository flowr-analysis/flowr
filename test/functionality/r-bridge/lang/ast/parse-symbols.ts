import { assertAst, sameForSteps, withShell } from '../../../_helper/shell'
import { exprList } from '../../../_helper/ast-builder'
import { rangeFrom } from '../../../../../src/util/range'
import { RType } from '../../../../../src/r-bridge'
import { DESUGAR_NORMALIZE, NORMALIZE } from '../../../../../src/core/steps/all/core/10-normalize'

describe('Parse symbols', withShell(shell => {
	assertAst('Simple Symbol', shell, 'a', sameForSteps([NORMALIZE, DESUGAR_NORMALIZE],
		exprList({
			type:      RType.Symbol,
			location:  rangeFrom(1, 1, 1, 1),
			namespace: undefined,
			lexeme:    'a',
			content:   'a',
			info:      {}
		}))
	)
	assertAst('With Namespace', shell, 'a::b', sameForSteps([NORMALIZE, DESUGAR_NORMALIZE],
		exprList({
			type:      RType.Symbol,
			location:  rangeFrom(1, 4, 1, 4),
			namespace: 'a',
			lexeme:    'b',
			content:   'b',
			info:      {}
		}))
	)
	assertAst('With Quotes and Namespace', shell, 'a::"b"', sameForSteps([NORMALIZE, DESUGAR_NORMALIZE],
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

