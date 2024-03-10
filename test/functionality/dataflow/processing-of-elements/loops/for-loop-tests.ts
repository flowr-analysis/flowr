import { assertDataflow, withShell } from '../../../_helper/shell'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'
import { defaultEnv } from '../../../_helper/environment-builder'

describe('for', withShell(shell => {
	assertDataflow('Single-vector for Loop',
		shell,
		'for(i in 0) i ',
		emptyGraph()
			.defineVariable('0', 'i')
			.use('2', 'i', { when: 'maybe', environment: defaultEnv().defineVariable('i', '0', '4') })
			.reads('2', '0', 'maybe')
	)

	describe('Potential redefinition with break', () => {
		const withXDefined = defaultEnv().defineVariable('x', '0', '2')
		const otherXDefined = defaultEnv().defineVariable('x', '7', '9', 'maybe')
		assertDataflow('Potential redefinition inside the same loop',
			shell,
			`repeat {
  x <- 2
  if(z) break
  x <- 3
}
x`,
			emptyGraph()
				.defineVariable('0', 'x')
				.defineVariable('7', 'x',  { environment: withXDefined })
				.use('3', 'z', { environment: withXDefined })
				.use('12', 'x', { environment: withXDefined.appendWritesOf(otherXDefined) })
				.reads('12', '0', 'always')
				.reads('12', '7', 'maybe')
				.sameDef('0', '7', 'maybe')
		)
	})

	const envWithX = () => defaultEnv().defineVariable('x', '0', '2')
	assertDataflow('Read in for Loop',
		shell,
		'x <- 12\nfor(i in 1:10) x ',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i',  { environment: envWithX() })
			.use('7', 'x', { when: 'maybe', environment: envWithX().defineVariable('i', '3', '9') })
			.reads('7', '0', 'maybe')
	)
	const envWithI = () => defaultEnv().defineVariable('i', '0', '8')
	assertDataflow('Read after for loop',
		shell,
		'for(i in 1:10) { x <- 12 }\n x',
		emptyGraph()
			.defineVariable('0', 'i')
			.defineVariable('4', 'x', { when: 'maybe',  environment: envWithI() })
			.use('9', 'x', { environment: envWithI().defineVariable('x', '4', '6', 'maybe') })
			.reads('9', '4', 'maybe')
	)


	const envWithFirstX = () => defaultEnv().defineVariable('x', '0', '2')
	const envInFor = () => envWithFirstX().defineVariable('i', '3', '11')
	const envOutFor = () => defaultEnv().defineVariable('i', '3', '11').defineVariable('x', '0', '2')
	const envWithSecondX = () => defaultEnv().defineVariable('x', '7', '9', 'maybe')

	assertDataflow('Read after for loop with outer def',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- 12 }\n x',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i', { environment: envWithFirstX() })
			.defineVariable('7', 'x', { when: 'maybe',  environment: envInFor() })
			.use('12', 'x', { environment: envOutFor().appendWritesOf(envWithSecondX()) })
			.reads('12', '0')
			.reads('12', '7', 'maybe')
			.sameDef('0', '7', 'maybe')
	)
	assertDataflow('Redefinition within loop',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- x }\n x',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i', { environment: envWithFirstX() })
			.defineVariable('7', 'x', { when: 'maybe',  environment: envInFor() })
			.use('8', 'x', { when: 'maybe', environment: envInFor() })
			.use('12', 'x', { environment: envOutFor().appendWritesOf(envWithSecondX()) })
			.reads('12', '0')
			.reads('12', '7', 'maybe')
			.reads('8', '0', 'maybe')
			.reads('8', '7', 'maybe')
			.definedBy('7', '8')
			.sameDef('0', '7', 'maybe')
	)

	const envInLargeFor = () => envWithFirstX().defineVariable('i', '3', '14')
	const envInLargeFor2 = () => envInLargeFor().defineVariable('x', '7', '9')
	const envOutLargeFor = () => envInLargeFor().defineVariable('x', '10', '12', 'maybe')

	assertDataflow('Redefinition within loop',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- x; x <- x }\n x',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i',  { environment: envWithFirstX() })
			.defineVariable('7', 'x', { when: 'maybe',  environment: envInLargeFor() })
			.use('8', 'x', { when: 'maybe', environment: envInLargeFor() })
			.defineVariable('10', 'x', { when: 'maybe',  environment: envInLargeFor2() })
			.use('11', 'x', /* this is wrong, but uncertainty is not fully supported in the impl atm.*/ { environment: envInLargeFor2() })
			.use('15', 'x',{ environment: envWithFirstX().appendWritesOf(envOutLargeFor()) })
			.reads('11', '7')// second x <- *x* always reads first *x* <- x
			.reads('8', '0', 'maybe')
			.reads('8', '10', 'maybe')
			.reads('15', '0', 'maybe')
			.reads('15', '10', 'maybe')
			.definedBy('7', '8')
			.definedBy('10', '11')
			.sameDef('0', '7', 'maybe')
			.sameDef('0', '10', 'maybe')
			.sameDef('7', '10') // both in same loop execution
	)

	const forLoopWithI = () => defaultEnv().defineVariable('i', '0', '9')
	const forLoopWithIAfter = () => defaultEnv().defineVariable('i', '0', '9', 'maybe')
	const forLoopAfterI = () => defaultEnv().defineVariable('i', '5', '7', 'maybe')

	assertDataflow('Redefinition within loop',
		shell,
		'for(i in 1:10) { i; i <- 12 }\n i',
		emptyGraph()
			.defineVariable('0', 'i')
			.defineVariable('5', 'i', { when: 'maybe',  environment: forLoopWithI() })
			.use('4', 'i', { when: 'maybe', environment: forLoopWithI() })
			.use('10', 'i', { environment: forLoopWithIAfter().appendWritesOf(forLoopAfterI()) })
			.reads('4', '0', 'maybe')
			.reads('10', '5', 'maybe')
			.reads('10', '0', 'maybe')
			.sameDef('5', '0')
	)
}))
