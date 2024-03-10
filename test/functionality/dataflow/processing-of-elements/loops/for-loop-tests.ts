import { assertDataflow, withShell } from '../../../_helper/shell'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'
import { defaultEnv } from '../../../_helper/environment-builder'

describe('for', withShell(shell => {
	assertDataflow('Single-vector for Loop',
		shell,
		'for(i in 0) i ',
		emptyGraph()
			.defineVariable('0', 'i')
			.use('2', 'i', { controlDependency: [] })
			.reads('2', '0')
	)

	describe('Potential redefinition with break', () => {
		const withXDefined = defaultEnv().defineVariable('x', '0', '2')
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
				.use('3', 'z' )
				.use('12', 'x')
				.reads('12', '0')
				.reads('12', '7')
				.sameDef('0', '7')
		)
	})

	const envWithX = () => defaultEnv().defineVariable('x', '0', '2')
	assertDataflow('Read in for Loop',
		shell,
		'x <- 12\nfor(i in 1:10) x ',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i',  { environment: envWithX() })
			.use('7', 'x', { controlDependency: [] })
			.reads('7', '0')
	)
	const envWithI = () => defaultEnv().defineVariable('i', '0', '8')
	assertDataflow('Read after for loop',
		shell,
		'for(i in 1:10) { x <- 12 }\n x',
		emptyGraph()
			.defineVariable('0', 'i')
			.defineVariable('4', 'x', { controlDependency: [],  environment: envWithI() })
			.use('9', 'x')
			.reads('9', '4')
	)


	const envWithFirstX = () => defaultEnv().defineVariable('x', '0', '2')
	const envInFor = () => envWithFirstX().defineVariable('i', '3', '11')

	assertDataflow('Read after for loop with outer def',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- 12 }\n x',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i', { environment: envWithFirstX() })
			.defineVariable('7', 'x', { controlDependency: [],  environment: envInFor() })
			.use('12', 'x')
			.reads('12', '0')
			.reads('12', '7')
			.sameDef('0', '7')
	)
	assertDataflow('Redefinition within loop',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- x }\n x',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i', { environment: envWithFirstX() })
			.defineVariable('7', 'x', { controlDependency: [],  environment: envInFor() })
			.use('8', 'x')
			.use('12', 'x')
			.reads('12', '0')
			.reads('12', '7')
			.reads('8', '0')
			.reads('8', '7')
			.definedBy('7', '8')
			.sameDef('0', '7')
	)

	const envInLargeFor = () => envWithFirstX().defineVariable('i', '3', '14')
	const envInLargeFor2 = () => envInLargeFor().defineVariable('x', '7', '9')

	assertDataflow('Redefinition within loop',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- x; x <- x }\n x',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i',  { environment: envWithFirstX() })
			.defineVariable('7', 'x', { controlDependency: [],  environment: envInLargeFor() })
			.use('8', 'x', { controlDependency: [] })
			.defineVariable('10', 'x', { controlDependency: [],  environment: envInLargeFor2() })
			.use('11', 'x', /* this is wrong, but uncertainty is not fully supported in the impl atm.*/)
			.use('15', 'x')
			.reads('11', '7')// second x <- *x* always reads first *x* <- x
			.reads('8', '0')
			.reads('8', '10')
			.reads('15', '0')
			.reads('15', '10')
			.definedBy('7', '8')
			.definedBy('10', '11')
			.sameDef('0', '7')
			.sameDef('0', '10')
			.sameDef('7', '10') // both in same loop execution
	)

	const forLoopWithI = () => defaultEnv().defineVariable('i', '0', '9')

	assertDataflow('Redefinition within loop',
		shell,
		'for(i in 1:10) { i; i <- 12 }\n i',
		emptyGraph()
			.defineVariable('0', 'i')
			.defineVariable('5', 'i', { controlDependency: [],  environment: forLoopWithI() })
			.use('4', 'i', { controlDependency: [] })
			.use('10', 'i')
			.reads('4', '0')
			.reads('10', '5')
			.reads('10', '0')
			.sameDef('5', '0')
	)
}))
