import { describe } from 'vitest';
import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';

describe.sequential("String Domain Eval Slice", withShell((shell) => {
  assertSliced(
    label("eval(paste)"),
    shell,
    `eval(parse(text=paste("a", "<-", "5")))\nprint(b)`,
    ["2:1"],
    'print(b)',
  )

  // assertSliced(
  //   label("eval(conditional)"),
  //   shell,
  //   `x <- if(u) { "a" } else { "b" }\neval(parse(text=paste(x, "<-", "5")))\nprint(c)`,
  //   ["3:1"],
  //   'print(c)',
  // )
}))
