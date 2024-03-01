import { assertDataflow, withShell } from '../../../_helper/shell'
import { initializeCleanEnvironments } from '../../../../../src/dataflow/v1'
import { appendEnvironments, define } from '../../../../../src/dataflow/common/environments'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

describe('for', withShell(shell => {
	assertDataflow('Single-vector for Loop',
		shell,
		'for(i in 0) i ',
		emptyGraph()
			.defineVariable('0', 'i')
			.use('2', 'i', { when: 'maybe', environment: define({ nodeId: '0', name: 'i', kind: 'variable', definedAt: '4', used: 'always' }, false, initializeCleanEnvironments()) })
			.reads('2', '0', 'maybe')
	)

	describe('Potential redefinition with break', () => {
		const withXDefined = define({ nodeId: '0', name: 'x', kind: 'variable', definedAt: '2', used: 'always' }, false, initializeCleanEnvironments())
		const otherXDefined = define({ nodeId: '7', name: 'x', kind: 'variable', definedAt: '9', used: 'maybe' }, false, initializeCleanEnvironments())
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
				.defineVariable('7', 'x', { environment: withXDefined })
				.use('3', 'z', { environment: withXDefined })
				.use('12', 'x', { environment: appendEnvironments(withXDefined, otherXDefined) })
				.reads('12', '0', 'always')
				.reads('12', '7', 'maybe')
				.sameDef('0', '7', 'maybe')
		)
	})

	const envWithX = () => define({ nodeId: '0', name: 'x', kind: 'variable', definedAt: '2', used: 'always' }, false, initializeCleanEnvironments())
	assertDataflow('Read in for Loop',
		shell,
		'x <- 12\nfor(i in 1:10) x ',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i', { environment: envWithX() })
			.use('7', 'x', { when: 'maybe', environment: define({ nodeId: '3', name: 'i', kind: 'variable', definedAt: '9', used: 'always' }, false, envWithX()) })
			.reads('7', '0', 'maybe')
	)
	const envWithI = () => define({ nodeId: '0', name: 'i', kind: 'variable', definedAt: '8', used: 'always' }, false, initializeCleanEnvironments())
	assertDataflow('Read after for loop',
		shell,
		'for(i in 1:10) { x <- 12 }\n x',
		emptyGraph()
			.defineVariable('0', 'i')
			.defineVariable('4', 'x', { when: 'maybe', environment: envWithI() })
			.use('9', 'x', { environment: define({ nodeId: '4', name: 'x', kind: 'variable', definedAt: '6', used: 'maybe' }, false, envWithI()) })
			.reads('9', '4', 'maybe')
	)


	const envWithFirstX = () => define({ nodeId: '0', name: 'x', kind: 'variable', definedAt: '2', used: 'always' }, false, initializeCleanEnvironments())
	const envInFor = () => define({ nodeId: '3', name: 'i', kind: 'variable', definedAt: '11', used: 'always' }, false,
		envWithFirstX()
	)

	const envOutFor = () => define({ nodeId: '3', name: 'i', kind: 'variable', definedAt: '11', used: 'always' }, false,
		define({ nodeId: '0', name: 'x', kind: 'variable', definedAt: '2', used: 'maybe' }, false, initializeCleanEnvironments())
	)

	const envWithSecondX = () => define({ nodeId: '7', name: 'x', kind: 'variable', definedAt: '9', used: 'maybe' }, false,
		initializeCleanEnvironments()
	)

	assertDataflow('Read after for loop with outer def',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- 12 }\n x',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i', { environment: envWithFirstX() })
			.defineVariable('7', 'x', { when: 'maybe', environment: envInFor() })
			.use('12', 'x', { environment: appendEnvironments(envOutFor(), envWithSecondX()) })
			.reads('12', '0', 'maybe')
			.reads('12', '7', 'maybe')
			.sameDef('0', '7', 'maybe')
	)
	assertDataflow('Redefinition within loop',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- x }\n x',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i', { environment: envWithFirstX() })
			.defineVariable('7', 'x', { when: 'maybe', environment: envInFor() })
			.use('8', 'x', { when: 'maybe', environment: envInFor() })
			.use('12', 'x', { environment: appendEnvironments(envOutFor(), envWithSecondX()) })
			.reads('12', '0', 'maybe')
			.reads('12', '7', 'maybe')
			.reads('8', '0', 'maybe')
			.reads('8', '7', 'maybe')
			.definedBy('7', '8')
			.sameDef('0', '7', 'maybe')
	)

	const envInLargeFor = () => define({ nodeId: '3', name: 'i', kind: 'variable', definedAt: '14', used: 'always' }, false,
		envWithFirstX()
	)

	const envInLargeFor2 = () => define({ nodeId: '7', name: 'x', kind: 'variable', definedAt: '9', used: 'always' }, false,
		envInLargeFor()
	)

	const envOutLargeFor = () => define({ nodeId: '10', name: 'x', kind: 'variable', definedAt: '12', used: 'maybe' }, false,
		envInLargeFor()
	)

	const envWithFirstXmaybe = () => define({ nodeId: '0', name: 'x', kind: 'variable', definedAt: '2', used: 'maybe' }, false, initializeCleanEnvironments())

	assertDataflow('Redefinition within loop',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- x; x <- x }\n x',
		emptyGraph()
			.defineVariable('0', 'x')
			.defineVariable('3', 'i', { environment: envWithFirstX() })
			.defineVariable('7', 'x', { when: 'maybe', environment: envInLargeFor() })
			.use('8', 'x', { when: 'maybe', environment: envInLargeFor() })
			.defineVariable('10', 'x',  { when: 'maybe', environment: envInLargeFor2() })
			.use('11', 'x', /* this is wrong, but uncertainty is not fully supported in the impl atm.*/ { environment: envInLargeFor2() })
			.use('15', 'x',{ environment: appendEnvironments(envWithFirstXmaybe(), envOutLargeFor()) })
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

	const forLoopWithI = () => define({ nodeId: '0', name: 'i', kind: 'variable', definedAt: '9', used: 'always' }, false,
		initializeCleanEnvironments()
	)

	const forLoopWithIAfter = () => define({ nodeId: '0', name: 'i', kind: 'variable', definedAt: '9', used: 'maybe' }, false,
		initializeCleanEnvironments()
	)
	const forLoopAfterI = () => define({ nodeId: '5', name: 'i', kind: 'variable', definedAt: '7', used: 'maybe' }, false,
		initializeCleanEnvironments()
	)
	assertDataflow('Redefinition within loop',
		shell,
		'for(i in 1:10) { i; i <- 12 }\n i',
		emptyGraph()
			.defineVariable('0', 'i')
			.defineVariable('5', 'i', { when: 'maybe', environment: forLoopWithI() })
			.use('4', 'i', { when: 'maybe', environment: forLoopWithI() })
			.use('10', 'i', { environment: appendEnvironments(forLoopWithIAfter(), forLoopAfterI()) })
			.reads('4', '0', 'maybe')
			.reads('10', '5', 'maybe')
			.reads('10', '0', 'maybe')
			.sameDef('5', '0')
	)
}))
