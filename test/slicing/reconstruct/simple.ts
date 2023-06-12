import { assertReconstructed, withShell } from '../../helper/shell'

describe('Simple', withShell(shell => {
  assertReconstructed('assignment', shell, 'x <- 5', ['0'], 'x <- 5')
}))
