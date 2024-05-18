import { assertSliced, withShell } from '../../_helper/shell'
import { label } from '../../_helper/label'
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators'
import type { SupportedFlowrCapabilityId } from '../../../../src/r-bridge/data/get'

describe('Control flow', withShell(shell => {
	describe('Branch Coverage', () => {
		assertSliced(label('nested if', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'if', 'unnamed-arguments']),
			shell, `x <- 1
if(x) {
  if(y) {
    x <- 3
  } else {
    x <- 2
  }
} else {
  x <- 4
}
print(x)`, ['11@x'], `if(x) { if(y) { x <- 3 } else 
    { x <- 2 } } else 
{ x <- 4 }
x`)

		const loops: [string, SupportedFlowrCapabilityId[]][] = [
			['repeat', ['repeat-loop']],
			['while(TRUE)', ['while-loop', 'logical']],
			['for(i in 1:100)', ['for-loop', 'numbers', 'name-normal']]
		]
		for(const [loop, caps] of loops){
			describe(loop, () => {
				assertSliced(label('Break immediately', [...caps, 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments']),
					shell, `x <- 1
${loop} {
   x <- 2;
   break
}
print(x)`, ['6@x'], 'x <- 2\nx')
				assertSliced(label('Break in condition', [...caps, 'name-normal', 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments', 'if']),
					shell, `x <- 1
${loop} {
   x <- 2;
   if(foo) 
      break
}
print(x)`, ['7@x'], 'x <- 2\nx')
				assertSliced(label('Next', [...caps]),
					shell, `x <- 1
${loop} {
   x <- 2;
   next;
   x <- 3;
}
print(x)`, ['7@x'], 'x <- 2\nx')
			})
		}
	})
}))
