import { assertAst, withShell } from "../../../helper/shell"
import { exprList } from "../../../helper/ast-builder"
import { rangeFrom } from "../../../../src/util/range"
import { RType } from '../../../../src/r-bridge'

describe("Parse the line directive", withShell(shell => {
	assertAst(
		`Simple line`,
		shell,
		`#line 42 "foo.R"`,
		exprList({
			type:     RType.LineDirective,
			info:     {},
			lexeme:   `#line 42 "foo.R"`,
			location: rangeFrom(1, 1, 1, 16),
			line:     42,
			file:     "foo.R"
		})
	)
})
)
