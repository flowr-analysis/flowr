import { assertDataflow, withShell } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder';
import { label } from '../../../_helper/label';
import { builtInId } from '../../../../../src/dataflow/environments/built-in';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { EmptyArgument } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { describe } from 'vitest';

describe.sequential('for', withShell(shell => {
	assertDataflow(label('Single-vector for Loop', ['for-loop', 'name-normal', 'numbers']),
		shell, 'for(i in 0) i',  emptyGraph()
			.use('2', 'i', { cds: [{ id: '4', when: true }] })
			.reads('2', '0')
			.argument('4', '2')
			.call('4', 'for', [argumentInCall('0'), argumentInCall('1'), argumentInCall('2')], { returns: [], reads: ['1', builtInId('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('i', '0', '4'), origin: ['builtin:for-loop'] })
			.calls('4', builtInId('for'))
			.argument('4', ['0', '1'])
			.nse('4', '2')
			.defineVariable('0', 'i', { definedBy: ['1'] })
			.constant('1')
	);

	describe('Potential redefinition with break', () => {
		assertDataflow(label('Potential redefinition inside the same loop', ['repeat-loop', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'if', 'break']),
			shell,
			`repeat {
  x <- 2
  if(z) break
  x <- 3
}
x`, emptyGraph()
				.use('5', 'z', { cds: [{ id: '13' }, { id: '8', when: true }] })
				.use('14', 'x')
				.reads('14', ['2', '9'])
				.call('4', '<-', [argumentInCall('2'), argumentInCall('3')], { origin: ['builtin:assignment'], returns: ['2'], reads: [builtInId('<-'), 3], onlyBuiltIn: true, controlDependencies: [{ id: '13' }, { id: '8', when: true }] })
				.calls('4', builtInId('<-'))
				.call('6', 'break', [], { origin: ['builtin:break'], returns: [], reads: [builtInId('break')], controlDependencies: [{ id: 13 }, { id: 8, when: true }], environment: defaultEnv().defineVariable('x', '2', '4') })
				.calls('6', builtInId('break'))
				.call('8', 'if', [argumentInCall('5'), argumentInCall('6'), EmptyArgument], { origin: ['builtin:if-then-else'], returns: ['6'], reads: [builtInId('if'), '5'], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '2', '4'), controlDependencies: [{ id: '13' }, { id: '8', when: true }]  })
				.calls('8', builtInId('if'))
				.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { origin: ['builtin:assignment'], returns: ['9'], reads: [builtInId('<-'), 10], onlyBuiltIn: true, controlDependencies: [{ id: '13' }, { id: 8, when: true }], environment: defaultEnv().defineVariable('x', '2', '4') })
				.calls('11', builtInId('<-'))
				.call('12', '{', [argumentInCall('4'), argumentInCall('8'), argumentInCall('11')], { origin: ['builtin:expression-list'], returns: ['11'], reads: [builtInId('{')], environment: defaultEnv().defineVariable('x', '2', '4').defineVariable('x', '9', '11', []), controlDependencies: [{ id: '13' }, { id: '8', when: true }]  })
				.calls('12', builtInId('{'))
				.call('13', 'repeat', [argumentInCall('12')], { origin: ['builtin:repeat-loop'], returns: [], reads: [builtInId('repeat')] })
				.calls('13', builtInId('repeat'))
				.nse('13', '12')
				.constant('3', { controlDependencies: [{ id: '13' }, { id: '8', when: true }] })
				.defineVariable('2', 'x', { definedBy: ['3', '4'], controlDependencies: [{ id: '13' }, { id: '8', when: true }] })
				.constant('10', { controlDependencies: [{ id: '13' }, { id: '8', when: true }] })
				.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [{ id: '13' }, { id: '8', when: true }] })
		);
	});

	assertDataflow(label('Read in for Loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop']), shell, 'x <- 12\nfor(i in 1:10) x ', emptyGraph()
		.use('7', 'x', { cds: [{ id: '9', when: true }] })
		.reads('7', '0')
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: ['builtin:assignment'], returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
		.calls('2', builtInId('<-'))
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { origin: ['builtin:default'], returns: [], reads: ['4', '5', builtInId(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('6', builtInId(':'))
		.call('9', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('7')], { origin: ['builtin:for-loop'], returns: [], reads: ['6', builtInId('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('i', '3', '9') })
		.calls('9', builtInId('for'))
		.nse('9', '7')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.defineVariable('3', 'i', { definedBy: ['6'] })
		.constant('4')
		.constant('5')
	);
	assertDataflow(label('Read after for loop', ['for-loop', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines']), shell, 'for(i in 1:10) { x <- 12 }\n x', emptyGraph()
		.use('11', 'x')
		.reads('11', '6')
		.call('3', ':', [argumentInCall('1'), argumentInCall('2')], { origin: ['builtin:default'], returns: [], reads: ['1', '2', builtInId(':')], onlyBuiltIn: true })
		.calls('3', builtInId(':'))
		.call('8', '<-', [argumentInCall('6'), argumentInCall('7')], { origin: ['builtin:assignment'], returns: ['6'], reads: [builtInId('<-'), 7], onlyBuiltIn: true, controlDependencies: [{ id: '10', when: true }] })
		.calls('8', builtInId('<-'))
		.call('9', '{', [argumentInCall('8')], { origin: ['builtin:expression-list'], returns: ['8'], reads: [builtInId('{')], controlDependencies: [{ id: '10', when: true }] })
		.calls('9', builtInId('{'))
		.call('10', 'for', [argumentInCall('0'), argumentInCall('3'), argumentInCall('9')], { origin: ['builtin:for-loop'], returns: [], reads: ['3', builtInId('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('i', '0', '10') })
		.calls('10', builtInId('for'))
		.nse('10', '9')
		.defineVariable('0', 'i', { definedBy: ['3'] })
		.constant('1')
		.constant('2')
		.constant('7', { controlDependencies: [{ id: '10', when: true }] })
		.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependencies: [{ id: '10', when: true }] })
	);


	assertDataflow(label('Read after for loop with outer def', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop']), shell, 'x <- 9\nfor(i in 1:10) { x <- 12 }\n x',  emptyGraph()
		.use('14', 'x')
		.reads('14', ['0', '9'])
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: ['builtin:assignment'], returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
		.calls('2', builtInId('<-'))
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { origin: ['builtin:default'], returns: [], reads: ['4', '5', builtInId(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('6', builtInId(':'))
		.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { origin: ['builtin:assignment'], returns: ['9'], reads: [builtInId('<-'), 10], onlyBuiltIn: true, controlDependencies: [{ id: '13', when: true }] })
		.calls('11', builtInId('<-'))
		.call('12', '{', [argumentInCall('11')], { origin: ['builtin:expression-list'], returns: ['11'], reads: [builtInId('{')], controlDependencies: [{ id: '13', when: true }] })
		.calls('12', builtInId('{'))
		.call('13', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('12')], { origin: ['builtin:for-loop'], returns: [], reads: ['6', builtInId('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '13') })
		.calls('13', builtInId('for'))
		.nse('13', '12')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.defineVariable('3', 'i', { definedBy: ['6'] })
		.constant('4')
		.constant('5')
		.constant('10', { controlDependencies: [{ id: '13', when: true }] })
		.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [{ id: '13', when: true }] })
	);
	assertDataflow(label('redefinition within loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop']), shell, 'x <- 9\nfor(i in 1:10) { x <- x }\n x',  emptyGraph()
		.use('10', 'x', { cds: [{ id: '13', when: true }] })
		.reads('10', ['9', '0'])
		.use('14', 'x')
		.reads('14', ['0', '9'])
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: ['builtin:assignment'], returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
		.calls('2', builtInId('<-'))
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { origin: ['builtin:default'], returns: [], reads: ['4', '5', builtInId(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('6', builtInId(':'))
		.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { origin: ['builtin:assignment'], returns: ['9'], reads: [builtInId('<-'), 10], onlyBuiltIn: true, controlDependencies: [{ id: '13', when: true }] })
		.calls('11', builtInId('<-'))
		.call('12', '{', [argumentInCall('11')], { origin: ['builtin:expression-list'], returns: ['11'], reads: [builtInId('{')], controlDependencies: [{ id: '13', when: true }] })
		.calls('12', builtInId('{'))
		.call('13', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('12')], { origin: ['builtin:for-loop'], returns: [], reads: ['6', builtInId('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '13') })
		.calls('13', builtInId('for'))
		.nse('13', '12')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.defineVariable('3', 'i', { definedBy: ['6'] })
		.constant('4')
		.constant('5')
		.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [{ id: '13', when: true }] })
	);

	assertDataflow(label('Simple Circular Redefinition', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop', 'semicolons']),
		shell, 'for(i in 1:10) x <- x + 1',
		emptyGraph().defineVariable('1@x', 'x', { controlDependencies: [{ id: 10, when: true }] }).use('1:21', 'x', { cds: [{ id: 10, when: true }] }).reads('1:21', '1@x'),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);

	assertDataflow(label('double redefinition within loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop', 'semicolons']), shell, 'x <- 9\nfor(i in 1:10) { x <- x; x <- x }\n x', emptyGraph()
		.use('10', 'x', { cds: [{ id: '16', when: true }] })
		.reads('10', ['12', '0'])
		.use('13', 'x', { cds: [{ id: '16', when: true }] })
		/* we should try to narrow this */
		.reads('13', ['0', '9', '12'])
		.use('17', 'x')
		.reads('17', ['0', '9', '12'])
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: ['builtin:assignment'], returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
		.calls('2', builtInId('<-'))
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { origin: ['builtin:default'], returns: [], reads: ['4', '5', builtInId(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('6', builtInId(':'))
		.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { origin: ['builtin:assignment'], returns: ['9'], reads: [builtInId('<-'), 10], onlyBuiltIn: true, controlDependencies: [{ id: '16', when: true }] })
		.calls('11', builtInId('<-'))
		.call('14', '<-', [argumentInCall('12'), argumentInCall('13')], { origin: ['builtin:assignment'], returns: ['12'], reads: [builtInId('<-'), 13], onlyBuiltIn: true, controlDependencies: [{ id: '16', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '16', when: true }]) })
		.calls('14', builtInId('<-'))
		.call('15', '{', [argumentInCall('11'), argumentInCall('14')], { origin: ['builtin:expression-list'], returns: ['14'], reads: [builtInId('{')], controlDependencies: [{ id: '16', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '16', when: true }]) })
		.calls('15', builtInId('{'))
		.call('16', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('15')], { origin: ['builtin:for-loop'], returns: [], reads: ['6', builtInId('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('x', '12', '14', []).defineVariable('i', '3', '16') })
		.calls('16', builtInId('for'))
		.nse('16', '15')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.defineVariable('3', 'i', { definedBy: ['6'] })
		.constant('4')
		.constant('5')
		.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [{ id: '16', when: true }] })
		.defineVariable('12', 'x', { definedBy: ['13', '14'], controlDependencies: [{ id: '16', when: true }] })
	);

	assertDataflow(label('loop-variable redefined within loop', ['name-normal', 'for-loop', 'semicolons', 'newlines', 'numbers']), shell, 'for(i in 1:10) { i; i <- 12 }\n i', emptyGraph()
		.use('6', 'i', { cds: [{ id: '11', when: true }] })
		.reads('6', '0')
		.use('12', 'i')
		.reads('12', ['0', '7'])
		.call('3', ':', [argumentInCall('1'), argumentInCall('2')], { origin: ['builtin:default'], returns: [], reads: ['1', '2', builtInId(':')], onlyBuiltIn: true })
		.calls('3', builtInId(':'))
		.call('9', '<-', [argumentInCall('7'), argumentInCall('8')], { origin: ['builtin:assignment'], returns: ['7'], reads: [builtInId('<-'), 8], onlyBuiltIn: true, controlDependencies: [{ id: '11', when: true }] })
		.calls('9', builtInId('<-'))
		.call('10', '{', [argumentInCall('6'), argumentInCall('9')], { origin: ['builtin:expression-list'], returns: ['9'], reads: [builtInId('{')], controlDependencies: [{ id: '11', when: true }] })
		.calls('10', builtInId('{'))
		.call('11', 'for', [argumentInCall('0'), argumentInCall('3'), argumentInCall('10')], { origin: ['builtin:for-loop'], returns: [], reads: ['3', builtInId('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('i', '0', '11', []).defineVariable('i', '7', '9', []) })
		.calls('11', builtInId('for'))
		.nse('11', '10')
		.defineVariable('0', 'i', { definedBy: ['3'] })
		.constant('1')
		.constant('2')
		.constant('8', { controlDependencies: [{ id: '11', when: true }] })
		.defineVariable('7', 'i', { definedBy: ['8', '9'], controlDependencies: [{ id: '11', when: true }] })
	);

	describe('Branch coverage', () => {
		describe('repeat', () => {
			assertDataflow(label('Break immediately', ['repeat-loop', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments']),
				shell, `x <- 1
repeat {
   x <- 2;
   break
}
print(x)`,  emptyGraph()
					.use('12', 'x')
					.reads('12', '5')
					.reads('12', '0')
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: ['builtin:assignment'], returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
					.calls('2', builtInId('<-'))
					.argument('2', ['1', '0'])
					.call('7', '<-', [argumentInCall('5'), argumentInCall('6')], { origin: ['builtin:assignment'], returns: ['5'], reads: [builtInId('<-'), 6], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2'), controlDependencies: [{ id: '10' }] })
					.calls('7', builtInId('<-'))
					.argument('7', ['6', '5'])
					.call('8', 'break', [], { origin: ['builtin:break'], returns: [], reads: [builtInId('break')], environment: defaultEnv().defineVariable('x', '5', '7'), controlDependencies: [{ id: '10' }] })
					.calls('8', builtInId('break'))
					.argument('9', '7')
					.argument('9', '8')
					.call('9', '{', [argumentInCall('7'), argumentInCall('8')], { origin: ['builtin:expression-list'], returns: [], reads: [builtInId('{')], environment: defaultEnv().defineVariable('x', '5', '7'), controlDependencies: [{ id: '10' }] })
					.calls('9', builtInId('{'))
					.argument('10', '9')
					.call('10', 'repeat', [argumentInCall('9')], { origin: ['builtin:repeat-loop'], returns: [], reads: [builtInId('repeat')], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('10', builtInId('repeat'))
					.nse('10', '9')
					.argument('14', '12')
					.reads('14', '12')
					.call('14', 'print', [argumentInCall('12')], { origin: ['builtin:default'], returns: ['12'], reads: [builtInId('print')], environment: defaultEnv().defineVariable('x', '5', '7') })
					.calls('14', builtInId('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('6', { controlDependencies: [{ id: '10' }] })
					.defineVariable('5', 'x', { definedBy: ['6', '7'], controlDependencies: [{ id: '10' }] })
					.markIdForUnknownSideEffects('14')
			);
			assertDataflow(label('Break in condition', ['repeat-loop', 'name-normal', 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments', 'if']),
				shell, `x <- 1
repeat {
   x <- 2;
   if(foo) 
      break
}
print(x)`, emptyGraph()
					.use('8', 'foo', { cds: [{ id: '13' }, { id: '11', when: true }] })
					.use('15', 'x')
					.reads('15', '5')
					.reads('15', '0')
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: ['builtin:assignment'], returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
					.calls('2',  builtInId('<-'))
					.argument('2', ['1', '0'])
					.call('7', '<-', [argumentInCall('5'), argumentInCall('6')], { origin: ['builtin:assignment'], returns: ['5'], reads: [builtInId('<-'), 6], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2'), controlDependencies: [{ id: '13' }, { id: '11', when: true }] })
					.calls('7', builtInId('<-'))
					.argument('7', ['6', '5'])
					.call('9', 'break', [], { origin: ['builtin:break'],  returns: [], reads: [builtInId('break')], controlDependencies: [{ id: '13' }, { id: '11', when: true }], environment: defaultEnv().defineVariable('x', '5', '7') })
					.calls('9', builtInId('break'))
					.argument('11', '8')
					.argument('11', '9')
					.call('11', 'if', [argumentInCall('8'), argumentInCall('9', { controlDependencies: [{ id: '13' }, { id: '11', when: true }] }), EmptyArgument], { origin: ['builtin:if-then-else'], returns: ['9'], reads: [builtInId('if'), '8'], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '5', '7'), controlDependencies: [{ id: '13' }, { id: '11', when: true }] })
					.calls('11', builtInId('if'))
					.argument('12', '7')
					.argument('12', '11')
					.call('12', '{', [argumentInCall('7'), argumentInCall('11')], {  origin: ['builtin:expression-list'], returns: ['11'], reads: [builtInId('{')], environment: defaultEnv().defineVariable('x', '5', '7'), controlDependencies: [{ id: '13' }, { id: '11', when: true }] })
					.calls('12', builtInId('{'))
					.argument('13', '12')
					.call('13', 'repeat', [argumentInCall('12')], { origin: ['builtin:repeat-loop'], returns: [], reads: [builtInId('repeat')], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('13', builtInId('repeat'))
					.nse('13', '12')
					.argument('17', '15')
					.reads('17', '15')
					.call('17', 'print', [argumentInCall('15')], {  origin: ['builtin:default'], returns: ['15'], reads: [builtInId('print')], environment: defaultEnv().defineVariable('x', '5', '7') })
					.calls('17', builtInId('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('6', { controlDependencies: [{ id: '13' }, { id: '11', when: true }] })
					.defineVariable('5', 'x', { definedBy: ['6', '7'], controlDependencies: [{ id: '13' }, { id: '11', when: true }] })
					.markIdForUnknownSideEffects('17')
			);
			assertDataflow(label('Next', ['repeat-loop', 'newlines', 'name-normal', 'numbers', 'next', 'semicolons', 'unnamed-arguments']),
				shell, `x <- 1
repeat {
   x <- 2;
   next;
   x <- 3;
}
print(x)`,  emptyGraph()
					.use('17', 'x')
					.reads('17', '5')
					.reads('17', '0')
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: ['builtin:assignment'], returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
					.calls('2' , builtInId('<-'))
					.argument('2', ['1', '0'])
					.call('7', '<-', [argumentInCall('5'), argumentInCall('6')], { origin: ['builtin:assignment'], returns: ['5'], reads: [builtInId('<-'), 6], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2'), controlDependencies: [{ id: '15' }] })
					.calls('7', builtInId('<-'))
					.argument('7', ['6', '5'])
					.call('8', 'next', [], { origin: ['builtin:default'], returns: [], reads: [builtInId('next')], environment: defaultEnv().defineVariable('x', '5', '7'), controlDependencies: [{ id: '15' }] })
					.calls('8', builtInId('next'))
					.argument('14', '7')
					.call('14', '{', [argumentInCall('7')], { origin: ['builtin:expression-list'], returns: [], reads: [builtInId('{')], environment: defaultEnv().defineVariable('x', '0', '2'), controlDependencies: [{ id: '15' }] })
					.calls('14', builtInId('{'))
					.argument('15', '14')
					.call('15', 'repeat', [argumentInCall('14')], { origin: ['builtin:repeat-loop'], returns: [], reads: [builtInId('repeat')], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('15', builtInId('repeat'))
					.nse('15', '14')
					.argument('19', '17')
					.reads('19', '17')
					.call('19', 'print', [argumentInCall('17')], { origin: ['builtin:default'], returns: ['17'], reads: [builtInId('print')], environment: defaultEnv().defineVariable('x', '5', '7') })
					.calls('19', builtInId('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('6', { controlDependencies: [{ id: '15' }] })
					.defineVariable('5', 'x', { definedBy: ['6', '7'], controlDependencies: [{ id: '15' }] })
					.markIdForUnknownSideEffects('19')
			);
		});

		describe('for', () => {
			assertDataflow(label('Break immediately', ['for-loop', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments']),
				shell, `x <- 1
for(i in 1:100) {
   x <- 2;
   break
}
print(x)`, emptyGraph()
					.use('16', 'x')
					.reads('16', ['0', '9'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
					.calls('2', builtInId('<-'))
					.argument('2', ['1', '0'])
					.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', builtInId(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('6', builtInId(':'))
					.argument('6', ['4', '5'])
					.call('11', '<-', [argumentInCall('9', { controlDependencies: [] }), argumentInCall('10', { controlDependencies: [{ id: '14' }] })], { returns: ['9'], reads: [builtInId('<-'), 10], onlyBuiltIn: true, controlDependencies: [{ id: '14', when: true }] })
					.calls('11', builtInId('<-'))
					.argument('11', ['10', '9'])
					.call('12', 'break', [], { origin: ['builtin:break'], returns: [], reads: [builtInId('break')], controlDependencies: [{ id: '14', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '14', when: true }]) })
					.calls('12', builtInId('break'))
					.argument('13', '11')
					.argument('13', '12')
					.call('13', '{', [argumentInCall('11', { controlDependencies: [] }), argumentInCall('12', { controlDependencies: [] })], { returns: ['12'], reads: [builtInId('{')], controlDependencies: [{ id: '14', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '14', when: true }]) })
					.calls('13', builtInId('{'))
					.argument('14', '6')
					.argument('14', '13')
					.call('14', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('13', { controlDependencies: [] })], { returns: [], reads: ['6', builtInId('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '14') })
					.calls('14', builtInId('for'))
					.argument('14', '3')
					.nse('14', '13')
					.argument('18', '16')
					.reads('18', '16')
					.call('18', 'print', [argumentInCall('16')], { returns: ['16'], reads: [builtInId('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '14') })
					.calls('18', builtInId('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.defineVariable('3', 'i', { definedBy: ['6'] })
					.constant('4')
					.constant('5')
					.constant('10', { controlDependencies: [{ id: '14', when: true }] })
					.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [ { id: '14', when: true }] })
					.markIdForUnknownSideEffects('18')
			);
			assertDataflow(label('Break in condition', ['for-loop', 'name-normal', 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments', 'if']),
				shell, `x <- 1
for(i in 1:100) {
   x <- 2;
   if(foo) 
      break
}
print(x)`,  emptyGraph()
					.use('12', 'foo', { cds: [{ id: '17', when: true }, { id: '15', when: true }] })
					.use('19', 'x')
					.reads('19', ['0', '9'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
					.calls('2', builtInId('<-'))
					.argument('2', ['1', '0'])
					.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', builtInId(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('6', builtInId(':'))
					.argument('6', ['4', '5'])
					.call('11', '<-', [argumentInCall('9', { controlDependencies: [] }), argumentInCall('10', { controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }] })], { returns: ['9'], reads: [builtInId('<-'), 10], onlyBuiltIn: true, controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }] })
					.calls('11', builtInId('<-'))
					.argument('11', ['10', '9'])
					.call('13', 'break', [], { origin: ['builtin:break'], returns: [], reads: [builtInId('break')], controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '17', when: true }]) })
					.calls('13', builtInId('break'))
					.argument('15', '12')
					.argument('15', '13')
					.call('15', 'if', [argumentInCall('12', { controlDependencies: [] }), argumentInCall('13', { controlDependencies: [] }), EmptyArgument], { returns: ['13'], reads: ['12', builtInId('if')], onlyBuiltIn: true, controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '17', when: true },{ id: '15', when: true }]) })
					.calls('15', builtInId('if'))
					.argument('16', '11')
					.argument('16', '15')
					.call('16', '{', [argumentInCall('11', { controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }] }), argumentInCall('15', { controlDependencies: [] })], { returns: ['15'], reads: [builtInId('{')], controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '17', when: true }, { id: '15', when: true }]) })
					.calls('16', builtInId('{'))
					.argument('17', '6')
					.argument('17', '16')
					.call('17', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('16', { controlDependencies: [] })], { returns: [], reads: ['6', builtInId('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '17') })
					.calls('17', builtInId('for'))
					.argument('17', '3')
					.nse('17', '16')
					.argument('21', '19')
					.reads('21', '19')
					.call('21', 'print', [argumentInCall('19')], { returns: ['19'], reads: [builtInId('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '17') })
					.calls('21', builtInId('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.defineVariable('3', 'i', { definedBy: ['6'] })
					.constant('4')
					.constant('5')
					.constant('10', { controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }] })
					.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [ { id: '17', when: true }, { id: '15', when: true }] })
					.markIdForUnknownSideEffects('21')
			);
			assertDataflow(label('Next', ['for-loop', 'newlines', 'name-normal', 'numbers', 'next', 'semicolons', 'unnamed-arguments']),
				shell, `x <- 1
for(i in 1:100) {
   x <- 2;
   next;
   x <- 3;
}
print(x)`,  emptyGraph()
					.use('21', 'x')
					.reads('21', ['0', '9', '14'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
					.calls('2', builtInId('<-'))
					.argument('2', ['1', '0'])
					.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', builtInId(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('6', builtInId(':'))
					.argument('6', ['4', '5'])
					.call('11', '<-', [argumentInCall('9', { controlDependencies: [] }), argumentInCall('10', { controlDependencies: [{ id: '19', when: true }] })], { returns: ['9'], reads: [builtInId('<-'), 10], onlyBuiltIn: true, controlDependencies: [{ id: '19', when: true }] })
					.calls('11', builtInId('<-'))
					.argument('11', ['10', '9'])
					.call('12', 'next', [], { returns: [], reads: [builtInId('next')], controlDependencies: [{ id: '19', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '19', when: true }]) })
					.calls('12', builtInId('next'))
					.call('16', '<-', [argumentInCall('14', { controlDependencies: [] }), argumentInCall('15', { controlDependencies: [{ id: '19', when: true }] })], { returns: ['14'], reads: [builtInId('<-'), 15], onlyBuiltIn: true, controlDependencies: [{ id: 19, when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '19', when: true }]) })
					.calls('16', builtInId('<-'))
					.argument('16', ['15', '14'])
					.argument('18', '11')
					.call('18', '{', [argumentInCall('11', { controlDependencies: [] })], { returns: ['11'], reads: [builtInId('{')], controlDependencies: [{ id: '19', when: true }] })
					.calls('18', builtInId('{'))
					.argument('19', '6')
					.argument('19', '18')
					.call('19', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('18', { controlDependencies: [] })], { returns: [], reads: ['6', builtInId('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('x', '14', '16', []).defineVariable('i', '3', '19') })
					.calls('19', builtInId('for'))
					.argument('19', '3')
					.nse('19', '18')
					.argument('23', '21')
					.reads('23', '21')
					.call('23', 'print', [argumentInCall('21')], { returns: ['21'], reads: [builtInId('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('x', '14', '16', []).defineVariable('i', '3', '19') })
					.calls('23', builtInId('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.defineVariable('3', 'i', { definedBy: ['6'] })
					.constant('4')
					.constant('5')
					.constant('10', { controlDependencies: [{ id: '19', when: true }] })
					.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [{ id: 19, when: true }] })
					.constant('15', { controlDependencies: [{ id: '19', when: true }] })
					.defineVariable('14', 'x', { definedBy: ['15', '16'], controlDependencies: [{ id: 19, when: true }] })
					.markIdForUnknownSideEffects('23')
			);
		});

		describe('while', () => {
			assertDataflow(label('Break immediately', ['while-loop', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments']),
				shell, `x <- 1
while(TRUE) {
   x <- 2;
   break
}
print(x)`,  emptyGraph()
					.use('13', 'x')
					.reads('13', ['0', '6'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
					.calls('2', builtInId('<-'))
					.argument('2', ['1', '0'])
					.call('8', '<-', [argumentInCall('6', { controlDependencies: [] }), argumentInCall('7', { controlDependencies: [{ id: '11', when: true }] })], { returns: ['6'], reads: [builtInId('<-'), 7], onlyBuiltIn: true, controlDependencies: [{ id: 11, when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('8', builtInId('<-'))
					.argument('8', ['7', '6'])
					.call('9', 'break', [], { origin: ['builtin:break'], returns: [], reads: [builtInId('break')], controlDependencies: [{ id: 11, when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '11', when: true }]) })
					.calls('9', builtInId('break'))
					.argument('10', '8')
					.argument('10', '9')
					.call('10', '{', [argumentInCall('8', { controlDependencies: [] }), argumentInCall('9', { controlDependencies: [] })], { returns: ['9'], reads: [builtInId('{')], controlDependencies: [{ id: 11, when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '11', when: true }]) })
					.calls('10', builtInId('{'))
					.argument('11', '10')
					.call('11', 'while', [argumentInCall('3'), argumentInCall('10', { controlDependencies: [] })], { returns: [], reads: ['3', builtInId('while')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '11', when: true }]) })
					.calls('11', builtInId('while'))
					.argument('11', '3')
					.nse('11', '10')
					.argument('15', '13')
					.reads('15', '13')
					.call('15', 'print', [argumentInCall('13')], { returns: ['13'], reads: [builtInId('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '6', '8', []) })
					.calls('15', builtInId('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('3')
					.constant('7', { controlDependencies: [{ id: '11', when: true }] })
					.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependencies: [{ id: 11, when: true }] })
					.markIdForUnknownSideEffects('15')
			);
			assertDataflow(label('Break in condition', ['while-loop', 'name-normal', 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments', 'if']),
				shell, `x <- 1
while(TRUE) {
   x <- 2;
   if(foo) 
      break
}
print(x)`, emptyGraph()
					.use('9', 'foo', { cds: [{ id: 14, when: true }, { id: '12', when: true }] })
					.use('16', 'x')
					.reads('16', ['0', '6'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
					.calls('2', builtInId('<-'))
					.argument('2', ['1', '0'])
					.call('8', '<-', [argumentInCall('6', { controlDependencies: [] }), argumentInCall('7', { controlDependencies: [{ id: '14', when: true }, { id: '12', when: true }] })], { returns: ['6'], reads: [builtInId('<-'), 7], onlyBuiltIn: true, controlDependencies: [{ id: 14, when: true }, { id: '12', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('8', builtInId('<-'))
					.argument('8', ['7', '6'])
					.call('10', 'break', [], { origin: ['builtin:break'], returns: [], reads: [builtInId('break')], controlDependencies: [{ id: 14, when: true }, { id: '12', when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }]) })
					.calls('10', builtInId('break'))
					.argument('12', '9')
					.argument('12', '10')
					.call('12', 'if', [argumentInCall('9', { controlDependencies: [] }), argumentInCall('10', { controlDependencies: [] }), EmptyArgument], { returns: ['10'], reads: [builtInId('if'), '9'], onlyBuiltIn: true, controlDependencies: [{ id: 14, when: true }, { id: '12', when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }, { id: '12', when: true }]) })
					.calls('12', builtInId('if'))
					.argument('13', '8')
					.argument('13', '12')
					.call('13', '{', [argumentInCall('8', { controlDependencies: [] }), argumentInCall('12', { controlDependencies: [] })], { returns: ['12'], reads: [builtInId('{')], controlDependencies: [{ id: 14, when: true }, { id: '12', when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }, { id: '12', when: true }]) })
					.calls('13', builtInId('{'))
					.argument('14', '13')
					.call('14', 'while', [argumentInCall('3'), argumentInCall('13', { controlDependencies: [] })], { returns: [], reads: ['3', builtInId('while')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }, { id: '12', when: true }]) })
					.calls('14', builtInId('while'))
					.argument('14', '3')
					.nse('14', '13')
					.argument('18', '16')
					.reads('18', '16')
					.call('18', 'print', [argumentInCall('16')], { returns: ['16'], reads: [builtInId('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '6', '8', []) })
					.calls('18', builtInId('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('3')
					.constant('7', { controlDependencies: [{ id: '14', when: true }, { id: '12', when: true }] })
					.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependencies: [{ id: 14, when: true }, { id: '12', when: true }] })
					.markIdForUnknownSideEffects('18')
			);
			assertDataflow(label('Next', ['while-loop', 'newlines', 'name-normal', 'numbers', 'next', 'semicolons', 'unnamed-arguments']),
				shell, `x <- 1
while(TRUE) {
   x <- 2;
   next;
   x <- 3;
}
print(x)`, emptyGraph()
					.use('18', 'x')
					.reads('18', ['0', '6', '11'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [builtInId('<-'), 1], onlyBuiltIn: true })
					.calls('2', builtInId('<-'))
					.argument('2', ['1', '0'])
					.call('8', '<-', [argumentInCall('6', { controlDependencies: [] }), argumentInCall('7', { controlDependencies: [{ id: '16', when: true }] })], { returns: ['6'], reads: [builtInId('<-'), 7], onlyBuiltIn: true, controlDependencies: [{ id: 16, when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('8', builtInId('<-'))
					.argument('8', ['7', '6'])
					.call('9', 'next', [], { returns: [], reads: [builtInId('next')], controlDependencies: [{ id: 16, when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]) })
					.calls('9', builtInId('next'))
					.call('13', '<-', [argumentInCall('11', { controlDependencies: [] }), argumentInCall('12', { controlDependencies: [{ id: '16', when: true }] })], { returns: ['11'], reads: [builtInId('<-'), 12], onlyBuiltIn: true, controlDependencies: [{ id: 16, when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]) })
					.calls('13', builtInId('<-'))
					.argument('13', ['12', '11'])
					.argument('15', '8')
					.call('15', '{', [argumentInCall('8', { controlDependencies: [{ id: 16, when: true }] })], { returns: ['8'], reads: [builtInId('{')], controlDependencies: [{ id: 16, when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]).defineVariable('x', '11', '13', []) })
					.calls('15', builtInId('{'))
					.argument('16', '15')
					.call('16', 'while', [argumentInCall('3'), argumentInCall('15', { controlDependencies: [] })], { returns: [], reads: ['3', builtInId('while')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]).defineVariable('x', '11', '13', []) })
					.calls('16', builtInId('while'))
					.argument('16', '3')
					.nse('16', '15')
					.argument('20', '18')
					.reads('20', '18')
					.call('20', 'print', [argumentInCall('18')], { returns: ['18'], reads: [builtInId('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '6', '8', []).defineVariable('x', '11', '13', []) })
					.calls('20', builtInId('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('3')
					.constant('7', { controlDependencies: [{ id: '16', when: true }] })
					.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependencies: [{ id: '16', when: true }] })
					.constant('12', { controlDependencies: [{ id: '16', when: true }] })
					.defineVariable('11', 'x', { definedBy: ['12', '13'], controlDependencies: [{ id: '16', when: true }] })
					.markIdForUnknownSideEffects('20')
			);
		});
	});
}));
