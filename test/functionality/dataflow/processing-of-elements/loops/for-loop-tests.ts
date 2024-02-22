import { assertDataflow, withShell } from '../../../_helper/shell'
import { initializeCleanEnvironments } from '../../../../../src/dataflow'
import { appendEnvironments, define } from '../../../../../src/dataflow/environments'
import { LocalScope } from '../../../../../src/dataflow/environments/scopes'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

describe('for', withShell(shell => {
	assertDataflow('Single-vector for Loop',
		shell,
		'for(i in 0) i ',
		emptyGraph()
			.definesVariable('0', 'i')
			.uses('2', 'i', {when: 'maybe', environment: define({ nodeId: '0', name: 'i', scope: LocalScope, kind: 'variable', definedAt: '4', used: 'always' }, LocalScope, initializeCleanEnvironments())})
			.reads('2', '0', 'maybe')
	)

	describe('Potential redefinition with break', () => {
		const withXDefined = define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments())
		const otherXDefined = define({ nodeId: '7', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '9', used: 'maybe' }, LocalScope, initializeCleanEnvironments())
		assertDataflow('Potential redefinition inside the same loop',
			shell,
			`repeat {
  x <- 2
  if(z) break
  x <- 3
}
x`,
			emptyGraph()
				.definesVariable('0', 'x')
				.definesVariable('7', 'x', LocalScope, {environment: withXDefined})
				.uses('3', 'z', {environment: withXDefined})
				.uses('12', 'x', {environment: appendEnvironments(withXDefined, otherXDefined)})
				.reads('12', '0', 'always')
				.reads('12', '7', 'maybe')
				.sameDef('0', '7', 'maybe')
		)
	})

	const envWithX = () => define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments())
	assertDataflow('Read in for Loop',
		shell,
		'x <- 12\nfor(i in 1:10) x ',
		emptyGraph()
			.definesVariable('0', 'x')
			.definesVariable('3', 'i', LocalScope, {environment: envWithX()})
			.uses('7', 'x', {when: 'maybe', environment: define({ nodeId: '3', name: 'i', scope: LocalScope, kind: 'variable', definedAt: '9', used: 'always' }, LocalScope, envWithX())})
			.reads('7', '0', 'maybe')
	)
	const envWithI = () => define({ nodeId: '0', name: 'i', scope: LocalScope, kind: 'variable', definedAt: '8', used: 'always' }, LocalScope, initializeCleanEnvironments())
	assertDataflow('Read after for loop',
		shell,
		'for(i in 1:10) { x <- 12 }\n x',
		emptyGraph()
			.definesVariable('0', 'i')
			.definesVariable('4', 'x', LocalScope, {when: 'maybe', environment: envWithI()})
			.uses('9', 'x', {environment: define({ nodeId: '4', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '6', used: 'maybe' }, LocalScope, envWithI())})
			.reads('9', '4', 'maybe')
	)


	const envWithFirstX = () => define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments())
	const envInFor = () => define({ nodeId: '3', name: 'i', scope: LocalScope, kind: 'variable', definedAt: '11', used: 'always' }, LocalScope,
		envWithFirstX()
	)

	const envOutFor = () => define({ nodeId: '3', name: 'i', scope: LocalScope, kind: 'variable', definedAt: '11', used: 'always' }, LocalScope,
		define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments())
	)

	const envWithSecondX = () => define({ nodeId: '7', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '9', used: 'maybe' }, LocalScope,
		initializeCleanEnvironments()
	)

	assertDataflow('Read after for loop with outer def',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- 12 }\n x',
		emptyGraph()
			.definesVariable('0', 'x')
			.definesVariable('3', 'i', LocalScope, {environment: envWithFirstX()})
			.definesVariable('7', 'x', LocalScope, {when: 'maybe', environment: envInFor()})
			.uses('12', 'x', {environment: appendEnvironments(envOutFor(), envWithSecondX())})
			.reads('12', '0')
			.reads('12', '7', 'maybe')
			.sameDef('0', '7', 'maybe')
	)
	assertDataflow('Redefinition within loop',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- x }\n x',
		emptyGraph()
			.definesVariable('0', 'x')
			.definesVariable('3', 'i', LocalScope, {environment: envWithFirstX()})
			.definesVariable('7', 'x', LocalScope, {when: 'maybe', environment: envInFor()})
			.uses('8', 'x', {when: 'maybe', environment: envInFor()})
			.uses('12', 'x', {environment: appendEnvironments(envOutFor(), envWithSecondX())})
			.reads('12', '0')
			.reads('12', '7', 'maybe')
			.reads('8', '0', 'maybe')
			.reads('8', '7', 'maybe')
			.definedBy('7', '8')
			.sameDef('0', '7', 'maybe')
	)

	const envInLargeFor = () => define({ nodeId: '3', name: 'i', scope: LocalScope, kind: 'variable', definedAt: '14', used: 'always' }, LocalScope,
		envWithFirstX()
	)

	const envInLargeFor2 = () => define({ nodeId: '7', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '9', used: 'always' }, LocalScope,
		envInLargeFor()
	)

	const envOutLargeFor = () => define({ nodeId: '10', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '12', used: 'maybe' }, LocalScope,
		envInLargeFor()
	)

	assertDataflow('Redefinition within loop',
		shell,
		'x <- 9\nfor(i in 1:10) { x <- x; x <- x }\n x',
		emptyGraph()
			.definesVariable('0', 'x')
			.definesVariable('3', 'i', LocalScope, {environment: envWithFirstX()})
			.definesVariable('7', 'x', LocalScope, {when: 'maybe', environment: envInLargeFor()})
			.uses('8', 'x', {when: 'maybe', environment: envInLargeFor() })
			.definesVariable('10', 'x', LocalScope, {when: 'maybe', environment: envInLargeFor2()})
			.uses('11', 'x', /* this is wrong, but uncertainty is not fully supported in the impl atm.*/ {environment: envInLargeFor2()})
			.uses('15', 'x',{environment: appendEnvironments(envWithFirstX(), envOutLargeFor())})
			.reads('11', '7')// second x <- *x* always reads first *x* <- x
			.reads('8', '0', 'maybe')
			.reads('8', '10', 'maybe')
			.reads('15', '0')
			.reads('15', '10', 'maybe')
			.definedBy('7', '8')
			.definedBy('10', '11')
			.sameDef('0', '7', 'maybe')
			.sameDef('0', '10', 'maybe')
			.sameDef('7', '10') // both in same loop execution
	)

	const forLoopWithI = () => define({ nodeId: '0', name: 'i', scope: LocalScope, kind: 'variable', definedAt: '9', used: 'always' }, LocalScope,
		initializeCleanEnvironments()
	)

	const forLoopWithIAfter = () => define({ nodeId: '0', name: 'i', scope: LocalScope, kind: 'variable', definedAt: '9', used: 'maybe' }, LocalScope,
		initializeCleanEnvironments()
	)
	const forLoopAfterI = () => define({ nodeId: '5', name: 'i', scope: LocalScope, kind: 'variable', definedAt: '7', used: 'maybe' }, LocalScope,
		initializeCleanEnvironments()
	)
	assertDataflow('Redefinition within loop',
		shell,
		'for(i in 1:10) { i; i <- 12 }\n i',
		emptyGraph()
			.definesVariable('0', 'i')
			.definesVariable('5', 'i', LocalScope, {when: 'maybe', environment: forLoopWithI()})
			.uses('4', 'i', {when: 'maybe', environment: forLoopWithI()})
			.uses('10', 'i', {environment: appendEnvironments(forLoopWithIAfter(), forLoopAfterI())})
			.reads('4', '0', 'maybe')
			.reads('10', '5', 'maybe')
			.reads('10', '0', 'maybe')
			.sameDef('5', '0')
	)
}))
