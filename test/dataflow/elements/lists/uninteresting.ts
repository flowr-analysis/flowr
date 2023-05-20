import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph } from '../../../../src/dataflow'

describe("0. Lists without variable references ", withShell(shell => {
  let idx = 0
  for (const b of ["1\n2\n3", "1;2;3", "{ 1 + 2 }\n{ 3 * 4 }"]) {
    assertDataflow(`0.${idx++} ${JSON.stringify(b)}`, shell,
      b,
      new DataflowGraph()
    )
  }
}))
