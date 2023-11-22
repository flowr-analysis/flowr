import { createPipeline } from '../../../../src/core/steps/pipeline'
import { IStep } from '../../../../src/core/steps'
import { expect } from 'chai'
import { PARSE_WITH_R_SHELL_STEP } from '../../../../src/core/steps/all/00-parse'

describe('dependency check', () => {
	describe('error-cases', () => {
		function negative(name: string, steps: IStep[], message: string | RegExp) {
			it(name, () => {
				expect(() => createPipeline(steps)).to.throw(message)
			})
		}
		negative('should throw on empty input', [], /empty/)
		negative('should throw on duplicate names',
			[PARSE_WITH_R_SHELL_STEP, PARSE_WITH_R_SHELL_STEP], /duplicate|not unique/)
		negative('should throw on invalid dependencies',
			[PARSE_WITH_R_SHELL_STEP, { ...PARSE_WITH_R_SHELL_STEP, name: 'parse-v2', dependencies: ['foo'] }], /invalid dependency|not exist/)
		negative('should throw on cycles',
			[PARSE_WITH_R_SHELL_STEP,
				{ ...PARSE_WITH_R_SHELL_STEP, name: 'parse-v1', dependencies: ['parse-v2'] },
				{ ...PARSE_WITH_R_SHELL_STEP, name: 'parse-v2', dependencies: ['parse-v1'] }
			], /cycle/)
	})
})
