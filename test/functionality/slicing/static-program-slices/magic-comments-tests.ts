import { label } from "../../_helper/label";
import {assertSliced, TestConfigurationWithOutput, withShell} from "../../_helper/shell";
import {makeMagicCommentHandler} from "../../../../src/reconstruct/auto-select/magic-comments";

function withMagicComments(expectedOutput?: string): Partial<TestConfigurationWithOutput> {
    return {
        expectedOutput,
        trimOutput: true,
        autoSelectIf: makeMagicCommentHandler()
    }
}

describe('Reconstruct with Magic Comments', withShell(shell => {
   describe('Without Comments', () => {
       assertSliced(label('full', ['local-left-assignment', 'assignments-and-bindings', 'numbers']),
         shell, 'x <- 2\ncat()\nx', ['3@x'],
         'x <- 2\nx',
           withMagicComments('[1] 2')
      )
   })
   describe('Include next Line', () => {
       assertSliced(label('full', ['local-left-assignment', 'assignments-and-bindings', 'numbers']),
           shell, 'x <- 2\n#xxx\n# flowr@include_next_line\ncat()\nx', ['5@x'],
           'x <- 2\ncat()\nx',
           withMagicComments('[1] 2')
       )
   })
}))
