import { assertAst, sameForSteps, withShell } from '../../../_helper/shell'
import { exprList } from '../../../_helper/ast-builder'
import { rangeFrom } from '../../../../../src/util/range'
import { RType } from '../../../../../src'
import { label } from '../../../_helper/label'
import { DESUGAR_NORMALIZE, NORMALIZE } from '../../../../../src/core/steps/all/core/10-normalize'

describe('Parse the line directive', withShell(shell => {
	assertAst(label('Simple line', ['comments']),
		shell, '#line 42 "foo.R"',
		sameForSteps([NORMALIZE, DESUGAR_NORMALIZE], exprList({
			type:     RType.LineDirective,
			info:     {},
			lexeme:   '#line 42 "foo.R"',
			location: rangeFrom(1, 1, 1, 16),
			line:     42,
			file:     'foo.R'
		}))
	)
})
)
