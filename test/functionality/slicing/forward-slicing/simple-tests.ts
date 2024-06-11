import { assertForwardSliced, withShell } from '../../_helper/shell'
import { label } from '../../_helper/label'

describe('Simple', withShell(shell => {
	assertForwardSliced(label('value of variable', []), shell,
		'x <- 1\nx', ['1@x'], 'x <- 1\nx')
}))
