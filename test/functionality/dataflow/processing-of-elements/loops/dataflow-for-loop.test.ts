import { assertDataflow, withShell } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder';
import { label } from '../../../_helper/label';
import { BuiltIn } from '../../../../../src/dataflow/environments/built-in';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { EmptyArgument } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { describe } from 'vitest';

describe.sequential('for', withShell(shell => {
	assertDataflow(label('Single-vector for Loop', ['for-loop', 'name-normal', 'numbers']),
		shell, 'for(i in 0) i',  emptyGraph()
			.use('2', 'i', { controlDependencies: [{ id: '4', when: true }] })
			.reads('2', '0')
			.argument('4', '2')
			.call('4', 'for', [argumentInCall('0'), argumentInCall('1'), argumentInCall('2')], { returns: [], reads: ['0', '1', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('i', '0', '4') })
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
				.use('5', 'z', { controlDependencies: [{ id: '13' }, { id: '8', when: true }] })
				.use('14', 'x')
				.reads('14', ['2', '9'])
				.call('4', '<-', [argumentInCall('2'), argumentInCall('3')], { returns: ['2'], reads: [BuiltIn], controlDependencies: [{ id: '13' }, { id: '8', when: true }] })
				.call('6', 'break', [], { returns: [], reads: [BuiltIn], controlDependencies: [{ id: '13' }, { id: '8', when: true }], environment: defaultEnv().defineVariable('x', '2', '4') })
				.call('8', 'if', [argumentInCall('5'), argumentInCall('6'), EmptyArgument], { returns: ['6'], reads: [BuiltIn, '5'], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '2', '4'), controlDependencies: [{ id: '13' }, { id: '8', when: true }]  })
				.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '2', '4') })
				.call('12', '{', [argumentInCall('4'), argumentInCall('8'), argumentInCall('11')], { returns: ['11'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '2', '4').defineVariable('x', '9', '11', []), controlDependencies: [{ id: '13' }, { id: '8', when: true }]  })
				.call('13', 'repeat', [argumentInCall('12')], { returns: [], reads: [BuiltIn] })
				.nse('13', '12')
				.constant('3', { controlDependencies: [{ id: '13' }, { id: '8', when: true }] })
				.defineVariable('2', 'x', { definedBy: ['3', '4'], controlDependencies: [{ id: '13' }, { id: '8', when: true }] })
				.constant('10', { controlDependencies: [{ id: '13' }, { id: '8', when: true }] })
				.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [] })
		);
	});

	assertDataflow(label('Read in for Loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop']), shell, 'x <- 12\nfor(i in 1:10) x ', emptyGraph()
		.use('7', 'x', { controlDependencies: [{ id: '9', when: true }] })
		.reads('7', '0')
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.call('9', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('7')], { returns: [], reads: ['3', '6', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('i', '3', '9') })
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
		.call('3', ':', [argumentInCall('1'), argumentInCall('2')], { returns: [], reads: ['1', '2', BuiltIn], onlyBuiltIn: true })
		.call('8', '<-', [argumentInCall('6'), argumentInCall('7')], { returns: ['6'], reads: [BuiltIn], controlDependencies: [{ id: '10', when: true }] })
		.call('9', '{', [argumentInCall('8')], { returns: ['8'], reads: [BuiltIn], controlDependencies: [{ id: '10', when: true }] })
		.call('10', 'for', [argumentInCall('0'), argumentInCall('3'), argumentInCall('9')], { returns: [], reads: ['0', '3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('i', '0', '10') })
		.nse('10', '9')
		.defineVariable('0', 'i', { definedBy: ['3'] })
		.constant('1')
		.constant('2')
		.constant('7', { controlDependencies: [{ id: '10', when: true }] })
		.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependencies: [] })
	);


	assertDataflow(label('Read after for loop with outer def', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop']), shell, 'x <- 9\nfor(i in 1:10) { x <- 12 }\n x',  emptyGraph()
		.use('14', 'x')
		.reads('14', ['0', '9'])
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [BuiltIn], controlDependencies: [{ id: '13', when: true }] })
		.call('12', '{', [argumentInCall('11')], { returns: ['11'], reads: [BuiltIn], controlDependencies: [{ id: '13', when: true }] })
		.call('13', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('12')], { returns: [], reads: ['3', '6', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '13') })
		.nse('13', '12')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.defineVariable('3', 'i', { definedBy: ['6'] })
		.constant('4')
		.constant('5')
		.constant('10', { controlDependencies: [{ id: '13', when: true }] })
		.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [] })
	);
	assertDataflow(label('redefinition within loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop']), shell, 'x <- 9\nfor(i in 1:10) { x <- x }\n x',  emptyGraph()
		.use('10', 'x', { controlDependencies: [{ id: '13', when: true }] })
		.reads('10', ['9', '0'])
		.use('14', 'x')
		.reads('14', ['0', '9'])
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [BuiltIn], controlDependencies: [{ id: '13', when: true }] })
		.call('12', '{', [argumentInCall('11')], { returns: ['11'], reads: [BuiltIn], controlDependencies: [{ id: '13', when: true }] })
		.call('13', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('12')], { returns: [], reads: ['3', '6', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '13') })
		.nse('13', '12')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.defineVariable('3', 'i', { definedBy: ['6'] })
		.constant('4')
		.constant('5')
		.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [] })
	);

	assertDataflow(label('Simple Circular Redefinition', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop', 'semicolons']),
		shell, 'for(i in 1:10) x <- x + 1',
		emptyGraph().defineVariable('1@x', 'x', { controlDependencies: [] }).use('1:21', 'x', { controlDependencies: [{ id: 10, when: true }] }).reads('1:21', '1@x'),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);

	assertDataflow(label('double redefinition within loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop', 'semicolons']), shell, 'x <- 9\nfor(i in 1:10) { x <- x; x <- x }\n x', emptyGraph()
		.use('10', 'x', { controlDependencies: [{ id: '16', when: true }] })
		.reads('10', ['12', '0'])
		.use('13', 'x', { controlDependencies: [{ id: '16', when: true }] })
		/* we should try to narrow this */
		.reads('13', ['0', '9', '12'])
		.use('17', 'x')
		.reads('17', ['0', '9', '12'])
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [BuiltIn], controlDependencies: [{ id: '16', when: true }] })
		.call('14', '<-', [argumentInCall('12'), argumentInCall('13')], { returns: ['12'], reads: [BuiltIn], controlDependencies: [{ id: '16', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '16', when: true }]) })
		.call('15', '{', [argumentInCall('11'), argumentInCall('14')], { returns: ['14'], reads: [BuiltIn], controlDependencies: [{ id: '16', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '16', when: true }]) })
		.call('16', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('15')], { returns: [], reads: ['3', '6', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('x', '12', '14', []).defineVariable('i', '3', '16') })
		.nse('16', '15')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.defineVariable('3', 'i', { definedBy: ['6'] })
		.constant('4')
		.constant('5')
		.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [] })
		.defineVariable('12', 'x', { definedBy: ['13', '14'], controlDependencies: [] })
	);

	assertDataflow(label('loop-variable redefined within loop', ['name-normal', 'for-loop', 'semicolons', 'newlines', 'numbers']), shell, 'for(i in 1:10) { i; i <- 12 }\n i', emptyGraph()
		.use('6', 'i', { controlDependencies: [{ id: '11', when: true }] })
		.reads('6', '0')
		.use('12', 'i')
		.reads('12', ['0', '7'])
		.call('3', ':', [argumentInCall('1'), argumentInCall('2')], { returns: [], reads: ['1', '2', BuiltIn], onlyBuiltIn: true })
		.call('9', '<-', [argumentInCall('7'), argumentInCall('8')], { returns: ['7'], reads: [BuiltIn], controlDependencies: [{ id: '11', when: true }] })
		.call('10', '{', [argumentInCall('6'), argumentInCall('9')], { returns: ['9'], reads: [BuiltIn], controlDependencies: [{ id: '11', when: true }] })
		.call('11', 'for', [argumentInCall('0'), argumentInCall('3'), argumentInCall('10')], { returns: [], reads: ['0', '3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('i', '0', '11', []).defineVariable('i', '7', '9', []) })
		.nse('11', '10')
		.defineVariable('0', 'i', { definedBy: ['3'] })
		.constant('1')
		.constant('2')
		.constant('8', { controlDependencies: [{ id: '11', when: true }] })
		.defineVariable('7', 'i', { definedBy: ['8', '9'], controlDependencies: [] })
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
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
					.argument('2', ['1', '0'])
					.call('7', '<-', [argumentInCall('5'), argumentInCall('6')], { returns: ['5'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2'), controlDependencies: [{ id: '10' }] })
					.argument('7', ['6', '5'])
					.call('8', 'break', [], { returns: [], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '5', '7'), controlDependencies: [{ id: '10' }] })
					.argument('9', '7')
					.argument('9', '8')
					.call('9', '{', [argumentInCall('7'), argumentInCall('8')], { returns: [], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '5', '7'), controlDependencies: [{ id: '10' }] })
					.argument('10', '9')
					.call('10', 'repeat', [argumentInCall('9')], { returns: [], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
					.nse('10', '9')
					.argument('14', '12')
					.reads('14', '12')
					.call('14', 'print', [argumentInCall('12')], { returns: ['12'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '5', '7') })
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
					.use('8', 'foo', { controlDependencies: [{ id: '13' }, { id: '11', when: true }] })
					.use('15', 'x')
					.reads('15', '5')
					.reads('15', '0')
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
					.argument('2', ['1', '0'])
					.call('7', '<-', [argumentInCall('5'), argumentInCall('6')], { returns: ['5'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2'), controlDependencies: [{ id: '13' }, { id: '11', when: true }] })
					.argument('7', ['6', '5'])
					.call('9', 'break', [], { returns: [], reads: [BuiltIn], controlDependencies: [{ id: '13' }, { id: '11', when: true }], environment: defaultEnv().defineVariable('x', '5', '7') })
					.argument('11', '8')
					.argument('11', '9')
					.call('11', 'if', [argumentInCall('8'), argumentInCall('9', { controlDependencies: [{ id: '13' }, { id: '11', when: true }] }), EmptyArgument], { returns: ['9'], reads: [BuiltIn, '8'], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '5', '7'), controlDependencies: [{ id: '13' }, { id: '11', when: true }] })
					.argument('12', '7')
					.argument('12', '11')
					.call('12', '{', [argumentInCall('7'), argumentInCall('11')], { returns: ['11'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '5', '7'), controlDependencies: [{ id: '13' }, { id: '11', when: true }] })
					.argument('13', '12')
					.call('13', 'repeat', [argumentInCall('12')], { returns: [], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
					.nse('13', '12')
					.argument('17', '15')
					.reads('17', '15')
					.call('17', 'print', [argumentInCall('15')], { returns: ['15'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '5', '7') })
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
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
					.argument('2', ['1', '0'])
					.call('7', '<-', [argumentInCall('5'), argumentInCall('6')], { returns: ['5'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2'), controlDependencies: [{ id: '15' }] })
					.argument('7', ['6', '5'])
					.call('8', 'next', [], { returns: [], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '5', '7'), controlDependencies: [{ id: '15' }] })
					.argument('14', '7')
					.call('14', '{', [argumentInCall('7')], { returns: [], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2'), controlDependencies: [{ id: '15' }] })
					.argument('15', '14')
					.call('15', 'repeat', [argumentInCall('14')], { returns: [], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
					.nse('15', '14')
					.argument('19', '17')
					.reads('19', '17')
					.call('19', 'print', [argumentInCall('17')], { returns: ['17'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '5', '7') })
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
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
					.argument('2', ['1', '0'])
					.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
					.argument('6', ['4', '5'])
					.call('11', '<-', [argumentInCall('9', { controlDependencies: [] }), argumentInCall('10', { controlDependencies: [{ id: '14' }] })], { returns: ['9'], reads: [BuiltIn], controlDependencies: [{ id: '14', when: true }] })
					.argument('11', ['10', '9'])
					.call('12', 'break', [], { returns: [], reads: [BuiltIn], controlDependencies: [{ id: '14', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '14', when: true }]) })
					.argument('13', '11')
					.argument('13', '12')
					.call('13', '{', [argumentInCall('11', { controlDependencies: [] }), argumentInCall('12', { controlDependencies: [] })], { returns: ['12'], reads: [BuiltIn], controlDependencies: [{ id: '14', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '14', when: true }]) })
					.argument('14', '6')
					.argument('14', '13')
					.call('14', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('13', { controlDependencies: [] })], { returns: [], reads: ['3', '6', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '14') })
					.argument('14', '3')
					.nse('14', '13')
					.argument('18', '16')
					.reads('18', '16')
					.call('18', 'print', [argumentInCall('16')], { returns: ['16'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '14') })
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.defineVariable('3', 'i', { definedBy: ['6'] })
					.constant('4')
					.constant('5')
					.constant('10', { controlDependencies: [{ id: '14', when: true }] })
					.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [] })
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
					.use('12', 'foo', { controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }] })
					.use('19', 'x')
					.reads('19', ['0', '9'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
					.argument('2', ['1', '0'])
					.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
					.argument('6', ['4', '5'])
					.call('11', '<-', [argumentInCall('9', { controlDependencies: [] }), argumentInCall('10', { controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }] })], { returns: ['9'], reads: [BuiltIn], controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }] })
					.argument('11', ['10', '9'])
					.call('13', 'break', [], { returns: [], reads: [BuiltIn], controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '17', when: true }]) })
					.argument('15', '12')
					.argument('15', '13')
					.call('15', 'if', [argumentInCall('12', { controlDependencies: [] }), argumentInCall('13', { controlDependencies: [] }), EmptyArgument], { returns: ['13'], reads: ['12', BuiltIn], onlyBuiltIn: true, controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '17', when: true },{ id: '15', when: true }]) })
					.argument('16', '11')
					.argument('16', '15')
					.call('16', '{', [argumentInCall('11', { controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }] }), argumentInCall('15', { controlDependencies: [] })], { returns: ['15'], reads: [BuiltIn], controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '17', when: true }, { id: '15', when: true }]) })
					.argument('17', '6')
					.argument('17', '16')
					.call('17', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('16', { controlDependencies: [] })], { returns: [], reads: ['3', '6', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '17') })
					.argument('17', '3')
					.nse('17', '16')
					.argument('21', '19')
					.reads('21', '19')
					.call('21', 'print', [argumentInCall('19')], { returns: ['19'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '17') })
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.defineVariable('3', 'i', { definedBy: ['6'] })
					.constant('4')
					.constant('5')
					.constant('10', { controlDependencies: [{ id: '17', when: true }, { id: '15', when: true }] })
					.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [] })
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
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
					.argument('2', ['1', '0'])
					.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
					.argument('6', ['4', '5'])
					.call('11', '<-', [argumentInCall('9', { controlDependencies: [] }), argumentInCall('10', { controlDependencies: [{ id: '19', when: true }] })], { returns: ['9'], reads: [BuiltIn], controlDependencies: [{ id: '19', when: true }] })
					.argument('11', ['10', '9'])
					.call('12', 'next', [], { returns: [], reads: [BuiltIn], controlDependencies: [{ id: '19', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '19', when: true }]) })
					.call('16', '<-', [argumentInCall('14', { controlDependencies: [] }), argumentInCall('15', { controlDependencies: [{ id: '19', when: true }] })], { returns: ['14'], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '19', when: true }]) })
					.argument('16', ['15', '14'])
					.argument('18', '11')
					.call('18', '{', [argumentInCall('11', { controlDependencies: [] })], { returns: ['11'], reads: [BuiltIn], controlDependencies: [{ id: '19', when: true }] })
					.argument('19', '6')
					.argument('19', '18')
					.call('19', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('18', { controlDependencies: [] })], { returns: [], reads: ['3', '6', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('x', '14', '16', []).defineVariable('i', '3', '19') })
					.argument('19', '3')
					.nse('19', '18')
					.argument('23', '21')
					.reads('23', '21')
					.call('23', 'print', [argumentInCall('21')], { returns: ['21'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('x', '14', '16', []).defineVariable('i', '3', '19') })
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.defineVariable('3', 'i', { definedBy: ['6'] })
					.constant('4')
					.constant('5')
					.constant('10', { controlDependencies: [{ id: '19', when: true }] })
					.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependencies: [] })
					.constant('15', { controlDependencies: [{ id: '19', when: true }] })
					.defineVariable('14', 'x', { definedBy: ['15', '16'], controlDependencies: [] })
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
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
					.argument('2', ['1', '0'])
					.call('8', '<-', [argumentInCall('6', { controlDependencies: [] }), argumentInCall('7', { controlDependencies: [{ id: '11', when: true }] })], { returns: ['6'], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2') })
					.argument('8', ['7', '6'])
					.call('9', 'break', [], { returns: [], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '11', when: true }]) })
					.argument('10', '8')
					.argument('10', '9')
					.call('10', '{', [argumentInCall('8', { controlDependencies: [] }), argumentInCall('9', { controlDependencies: [] })], { returns: ['9'], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '11', when: true }]) })
					.argument('11', '10')
					.call('11', 'while', [argumentInCall('3'), argumentInCall('10', { controlDependencies: [] })], { returns: [], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '11', when: true }]) })
					.argument('11', '3')
					.nse('11', '10')
					.argument('15', '13')
					.reads('15', '13')
					.call('15', 'print', [argumentInCall('13')], { returns: ['13'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '6', '8', []) })
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('3')
					.constant('7', { controlDependencies: [{ id: '11', when: true }] })
					.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependencies: [] })
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
					.use('9', 'foo', { controlDependencies: [] })
					.use('16', 'x')
					.reads('16', ['0', '6'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
					.argument('2', ['1', '0'])
					.call('8', '<-', [argumentInCall('6', { controlDependencies: [] }), argumentInCall('7', { controlDependencies: [{ id: '14', when: true }, { id: '12', when: true }] })], { returns: ['6'], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2') })
					.argument('8', ['7', '6'])
					.call('10', 'break', [], { returns: [], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }]) })
					.argument('12', '9')
					.argument('12', '10')
					.call('12', 'if', [argumentInCall('9', { controlDependencies: [] }), argumentInCall('10', { controlDependencies: [] }), EmptyArgument], { returns: ['10'], reads: [BuiltIn, '9'], onlyBuiltIn: true, controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }, { id: '12', when: true }]) })
					.argument('13', '8')
					.argument('13', '12')
					.call('13', '{', [argumentInCall('8', { controlDependencies: [] }), argumentInCall('12', { controlDependencies: [] })], { returns: ['12'], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }, { id: '12', when: true }]) })
					.argument('14', '13')
					.call('14', 'while', [argumentInCall('3'), argumentInCall('13', { controlDependencies: [] })], { returns: [], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }, { id: '12', when: true }]) })
					.argument('14', '3')
					.nse('14', '13')
					.argument('18', '16')
					.reads('18', '16')
					.call('18', 'print', [argumentInCall('16')], { returns: ['16'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '6', '8', []) })
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('3')
					.constant('7', { controlDependencies: [{ id: '14', when: true }, { id: '12', when: true }] })
					.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependencies: [] })
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
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
					.argument('2', ['1', '0'])
					.call('8', '<-', [argumentInCall('6', { controlDependencies: [] }), argumentInCall('7', { controlDependencies: [{ id: '16', when: true }] })], { returns: ['6'], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2') })
					.argument('8', ['7', '6'])
					.call('9', 'next', [], { returns: [], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]) })
					.call('13', '<-', [argumentInCall('11', { controlDependencies: [] }), argumentInCall('12', { controlDependencies: [{ id: '16', when: true }] })], { returns: ['11'], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]) })
					.argument('13', ['12', '11'])
					.argument('15', '8')
					.call('15', '{', [argumentInCall('8', { controlDependencies: [] })], { returns: ['8'], reads: [BuiltIn], controlDependencies: [], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]).defineVariable('x', '11', '13', []) })
					.argument('16', '15')
					.call('16', 'while', [argumentInCall('3'), argumentInCall('15', { controlDependencies: [] })], { returns: [], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]).defineVariable('x', '11', '13', []) })
					.argument('16', '3')
					.nse('16', '15')
					.argument('20', '18')
					.reads('20', '18')
					.call('20', 'print', [argumentInCall('18')], { returns: ['18'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '6', '8', []).defineVariable('x', '11', '13', []) })
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('3')
					.constant('7', { controlDependencies: [{ id: '16', when: true }] })
					.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependencies: [] })
					.constant('12', { controlDependencies: [{ id: '16', when: true }] })
					.defineVariable('11', 'x', { definedBy: ['12', '13'], controlDependencies: [] })
					.markIdForUnknownSideEffects('20')
			);
		});
	});
}));
