import { assertDataflow, withShell } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder';
import { label } from '../../../_helper/label';
import { BuiltInProcName } from '../../../../../src/dataflow/environments/built-in';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { EmptyArgument } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { describe } from 'vitest';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe.sequential('for', withShell(shell => {
	assertDataflow(label('Single-vector for Loop', ['for-loop', 'name-normal', 'numbers']),
		shell, 'for(i in 0) i',  emptyGraph()
			.use('2', 'i', { cds: [{ id: '4', when: true }] })
			.reads('2', '0')
			.argument('4', '2')
			.call('4', 'for', [argumentInCall('0'), argumentInCall('1'), argumentInCall('2')], { returns: [], reads: ['1', NodeId.toBuiltIn('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('i', '0', '4'), origin: [BuiltInProcName.ForLoop] })
			.calls('4', NodeId.toBuiltIn('for'))
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
				.call('4', '<-', [argumentInCall('2'), argumentInCall('3')], { origin: [BuiltInProcName.Assignment], returns: ['2'], reads: [NodeId.toBuiltIn('<-'), 3], onlyBuiltIn: true, cds: [{ id: '13' }, { id: '8', when: true }] })
				.calls('4', NodeId.toBuiltIn('<-'))
				.call('6', 'break', [], { origin: [BuiltInProcName.Break], returns: [], reads: [NodeId.toBuiltIn('break')], cds: [{ id: 13 }, { id: 8, when: true }], environment: defaultEnv().defineVariable('x', '2', '4') })
				.calls('6', NodeId.toBuiltIn('break'))
				.call('8', 'if', [argumentInCall('5'), argumentInCall('6'), EmptyArgument], { origin: [BuiltInProcName.IfThenElse], returns: ['6'], reads: [NodeId.toBuiltIn('if'), '5'], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '2', '4'), cds: [{ id: '13' }, { id: '8', when: false }]  })
				.calls('8', NodeId.toBuiltIn('if'))
				.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { origin: [BuiltInProcName.Assignment], returns: ['9'], reads: [NodeId.toBuiltIn('<-'), 10], onlyBuiltIn: true, cds: [{ id: '13' }, { id: 8, when: true }], environment: defaultEnv().defineVariable('x', '2', '4') })
				.calls('11', NodeId.toBuiltIn('<-'))
				.call('12', '{', [argumentInCall('4'), argumentInCall('8'), argumentInCall('11')], { origin: [BuiltInProcName.ExpressionList], returns: ['11'], reads: [NodeId.toBuiltIn('{')], environment: defaultEnv().defineVariable('x', '2', '4').defineVariable('x', '9', '11', []), cds: [{ id: '13' }, { id: '8', when: true }]  })
				.calls('12', NodeId.toBuiltIn('{'))
				.call('13', 'repeat', [argumentInCall('12')], { origin: [BuiltInProcName.RepeatLoop], returns: [], reads: [NodeId.toBuiltIn('repeat')] })
				.calls('13', NodeId.toBuiltIn('repeat'))
				.nse('13', '12')
				.constant('3', { cds: [{ id: '13' }, { id: '8', when: true }] })
				.defineVariable('2', 'x', { definedBy: ['3', '4'], cds: [{ id: '13' }, { id: '8', when: true }] })
				.constant('10', { cds: [{ id: '13' }, { id: '8', when: true }] })
				.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [{ id: '13' }, { id: '8', when: true }] })
		);
	});

	assertDataflow(label('Read in for Loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop']), shell, 'x <- 12\nfor(i in 1:10) x ', emptyGraph()
		.use('7', 'x', { cds: [{ id: '9', when: true }] })
		.reads('7', '0')
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: [BuiltInProcName.Assignment], returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
		.calls('2', NodeId.toBuiltIn('<-'))
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { origin: [BuiltInProcName.Default], returns: [], reads: ['4', '5', NodeId.toBuiltIn(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('6', NodeId.toBuiltIn(':'))
		.call('9', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('7')], { origin: [BuiltInProcName.ForLoop], returns: [], reads: ['6', NodeId.toBuiltIn('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('i', '3', '9') })
		.calls('9', NodeId.toBuiltIn('for'))
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
		.call('3', ':', [argumentInCall('1'), argumentInCall('2')], { origin: [BuiltInProcName.Default], returns: [], reads: ['1', '2', NodeId.toBuiltIn(':')], onlyBuiltIn: true })
		.calls('3', NodeId.toBuiltIn(':'))
		.call('8', '<-', [argumentInCall('6'), argumentInCall('7')], { origin: [BuiltInProcName.Assignment], returns: ['6'], reads: [NodeId.toBuiltIn('<-'), 7], onlyBuiltIn: true, cds: [{ id: '10', when: true }] })
		.calls('8', NodeId.toBuiltIn('<-'))
		.call('9', '{', [argumentInCall('8')], { origin: [BuiltInProcName.ExpressionList], returns: ['8'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '10', when: true }] })
		.calls('9', NodeId.toBuiltIn('{'))
		.call('10', 'for', [argumentInCall('0'), argumentInCall('3'), argumentInCall('9')], { origin: [BuiltInProcName.ForLoop], returns: [], reads: ['3', NodeId.toBuiltIn('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('i', '0', '10') })
		.calls('10', NodeId.toBuiltIn('for'))
		.nse('10', '9')
		.defineVariable('0', 'i', { definedBy: ['3'] })
		.constant('1')
		.constant('2')
		.constant('7')
		.defineVariable('6', 'x', { definedBy: ['7', '8'], cds: [{ id: '10', when: true }] })
	);


	assertDataflow(label('Read after for loop with outer def', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop']), shell, 'x <- 9\nfor(i in 1:10) { x <- 12 }\n x',  emptyGraph()
		.use('14', 'x')
		.reads('14', ['0', '9'])
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: [BuiltInProcName.Assignment], returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
		.calls('2', NodeId.toBuiltIn('<-'))
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { origin: [BuiltInProcName.Default], returns: [], reads: ['4', '5', NodeId.toBuiltIn(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('6', NodeId.toBuiltIn(':'))
		.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { origin: [BuiltInProcName.Assignment], returns: ['9'], reads: [NodeId.toBuiltIn('<-'), 10], onlyBuiltIn: true, cds: [{ id: '13', when: true }] })
		.calls('11', NodeId.toBuiltIn('<-'))
		.call('12', '{', [argumentInCall('11')], { origin: [BuiltInProcName.ExpressionList], returns: ['11'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '13', when: true }] })
		.calls('12', NodeId.toBuiltIn('{'))
		.call('13', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('12')], { origin: [BuiltInProcName.ForLoop], returns: [], reads: ['6', NodeId.toBuiltIn('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '13') })
		.calls('13', NodeId.toBuiltIn('for'))
		.nse('13', '12')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.defineVariable('3', 'i', { definedBy: ['6'] })
		.constant('4')
		.constant('5')
		.constant('10')
		.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [{ id: '13', when: true }] })
	);
	assertDataflow(label('redefinition within loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop']), shell, 'x <- 9\nfor(i in 1:10) { x <- x }\n x',  emptyGraph()
		.use('10', 'x', { cds: [{ id: '13', when: true }] })
		.reads('10', ['9', '0'])
		.use('14', 'x')
		.reads('14', ['0', '9'])
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: [BuiltInProcName.Assignment], returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
		.calls('2', NodeId.toBuiltIn('<-'))
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { origin: [BuiltInProcName.Default], returns: [], reads: ['4', '5', NodeId.toBuiltIn(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('6', NodeId.toBuiltIn(':'))
		.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { origin: [BuiltInProcName.Assignment], returns: ['9'], reads: [NodeId.toBuiltIn('<-'), 10], onlyBuiltIn: true, cds: [{ id: '13', when: true }] })
		.calls('11', NodeId.toBuiltIn('<-'))
		.call('12', '{', [argumentInCall('11')], { origin: [BuiltInProcName.ExpressionList], returns: ['11'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '13', when: true }] })
		.calls('12', NodeId.toBuiltIn('{'))
		.call('13', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('12')], { origin: [BuiltInProcName.ForLoop], returns: [], reads: ['6', NodeId.toBuiltIn('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '13') })
		.calls('13', NodeId.toBuiltIn('for'))
		.nse('13', '12')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.defineVariable('3', 'i', { definedBy: ['6'] })
		.constant('4')
		.constant('5')
		.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [{ id: '13', when: true }] })
	);

	assertDataflow(label('Simple Circular Redefinition', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop', 'semicolons']),
		shell, 'for(i in 1:10) x <- x + 1',
		emptyGraph().defineVariable('1@x', 'x', { cds: [{ id: 10, when: true }] }).use('1:21', 'x', { cds: [{ id: 10, when: true }] }).reads('1:21', '1@x'),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('double redefinition within loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'for-loop', 'semicolons']), shell, 'x <- 9\nfor(i in 1:10) { x <- x;\nx <- x }\n x', emptyGraph()
		.use('10', 'x', { cds: [{ id: '16', when: true }] })
		.reads('10', ['12', '0'])
		.use('13', 'x', { cds: [{ id: '16', when: true }] })
		.reads('13', [9])
		.use('17', 'x')
		.reads('17', ['0', '12'])
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: [BuiltInProcName.Assignment], returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
		.calls('2', NodeId.toBuiltIn('<-'))
		.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { origin: [BuiltInProcName.Default], returns: [], reads: ['4', '5', NodeId.toBuiltIn(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('6', NodeId.toBuiltIn(':'))
		.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { origin: [BuiltInProcName.Assignment], returns: ['9'], reads: [NodeId.toBuiltIn('<-'), 10], onlyBuiltIn: true, cds: [{ id: '16', when: true }] })
		.calls('11', NodeId.toBuiltIn('<-'))
		.call('14', '<-', [argumentInCall('12'), argumentInCall('13')], { origin: [BuiltInProcName.Assignment], returns: ['12'], reads: [NodeId.toBuiltIn('<-'), 13], onlyBuiltIn: true, cds: [{ id: '16', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '16', when: true }]) })
		.calls('14', NodeId.toBuiltIn('<-'))
		.call('15', '{', [argumentInCall('11'), argumentInCall('14')], { origin: [BuiltInProcName.ExpressionList], returns: ['14'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '16', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '16', when: true }]) })
		.calls('15', NodeId.toBuiltIn('{'))
		.call('16', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('15')], { origin: [BuiltInProcName.ForLoop], returns: [], reads: ['6', NodeId.toBuiltIn('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('x', '12', '14', []).defineVariable('i', '3', '16') })
		.calls('16', NodeId.toBuiltIn('for'))
		.nse('16', '15')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.defineVariable('3', 'i', { definedBy: ['6'] })
		.constant('4')
		.constant('5')
		.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [{ id: '16', when: true }] })
		.defineVariable('12', 'x', { definedBy: ['13', '14'], cds: [{ id: '16', when: true }] })
	);

	assertDataflow(label('loop-variable redefined within loop', ['name-normal', 'for-loop', 'semicolons', 'newlines', 'numbers']), shell, 'for(i in 1:10) { i; i <- 12 }\n i', emptyGraph()
		.use('6', 'i', { cds: [{ id: '11', when: true }] })
		.reads('6', ['0', '7'])
		.use('12', 'i')
		.reads('12', ['0', '7'])
		.call('3', ':', [argumentInCall('1'), argumentInCall('2')], { origin: [BuiltInProcName.Default], returns: [], reads: ['1', '2', NodeId.toBuiltIn(':')], onlyBuiltIn: true })
		.calls('3', NodeId.toBuiltIn(':'))
		.call('9', '<-', [argumentInCall('7'), argumentInCall('8')], { origin: [BuiltInProcName.Assignment], returns: ['7'], reads: [NodeId.toBuiltIn('<-'), 8], onlyBuiltIn: true, cds: [{ id: '11', when: true }] })
		.calls('9', NodeId.toBuiltIn('<-'))
		.call('10', '{', [argumentInCall('6'), argumentInCall('9')], { origin: [BuiltInProcName.ExpressionList], returns: ['9'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '11', when: true }] })
		.calls('10', NodeId.toBuiltIn('{'))
		.call('11', 'for', [argumentInCall('0'), argumentInCall('3'), argumentInCall('10')], { origin: [BuiltInProcName.ForLoop], returns: [], reads: ['3', NodeId.toBuiltIn('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('i', '0', '11', []).defineVariable('i', '7', '9', []) })
		.calls('11', NodeId.toBuiltIn('for'))
		.nse('11', '10')
		.defineVariable('0', 'i', { definedBy: ['3'] })
		.constant('1')
		.constant('2')
		.constant('8')
		.defineVariable('7', 'i', { definedBy: ['8', '9'], cds: [{ id: '11', when: true }] })
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
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: [BuiltInProcName.Assignment], returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
					.calls('2', NodeId.toBuiltIn('<-'))
					.argument('2', ['1', '0'])
					.call('7', '<-', [argumentInCall('5'), argumentInCall('6')], { origin: [BuiltInProcName.Assignment], returns: ['5'], reads: [NodeId.toBuiltIn('<-'), 6], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2'), cds: [{ id: '10' }] })
					.calls('7', NodeId.toBuiltIn('<-'))
					.argument('7', ['6', '5'])
					.call('8', 'break', [], { origin: [BuiltInProcName.Break], returns: [], reads: [NodeId.toBuiltIn('break')], environment: defaultEnv().defineVariable('x', '5', '7'), cds: [{ id: '10' }] })
					.calls('8', NodeId.toBuiltIn('break'))
					.argument('9', '7')
					.argument('9', '8')
					.call('9', '{', [argumentInCall('7'), argumentInCall('8')], { origin: [BuiltInProcName.ExpressionList], returns: [], reads: [NodeId.toBuiltIn('{')], environment: defaultEnv().defineVariable('x', '5', '7'), cds: [{ id: '10' }] })
					.calls('9', NodeId.toBuiltIn('{'))
					.argument('10', '9')
					.call('10', 'repeat', [argumentInCall('9')], { origin: [BuiltInProcName.RepeatLoop], returns: [], reads: [NodeId.toBuiltIn('repeat')], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('10', NodeId.toBuiltIn('repeat'))
					.nse('10', '9')
					.argument('14', '12')
					.reads('14', '12')
					.call('14', 'print', [argumentInCall('12')], { origin: [BuiltInProcName.Default], returns: ['12'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '5', '7') })
					.calls('14', NodeId.toBuiltIn('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('6', { cds: [{ id: '10' }] })
					.defineVariable('5', 'x', { definedBy: ['6', '7'], cds: [{ id: '10' }] })
					.markIdForUnknownSideEffects('14')
			);
			assertDataflow(label('Break in condition (repeat)', ['repeat-loop', 'name-normal', 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments', 'if']),
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
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: [BuiltInProcName.Assignment], returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
					.calls('2',  NodeId.toBuiltIn('<-'))
					.argument('2', ['1', '0'])
					.call('7', '<-', [argumentInCall('5'), argumentInCall('6')], { origin: [BuiltInProcName.Assignment], returns: ['5'], reads: [NodeId.toBuiltIn('<-'), 6], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2'), cds: [{ id: '13' }, { id: '11', when: true }] })
					.calls('7', NodeId.toBuiltIn('<-'))
					.argument('7', ['6', '5'])
					.call('9', 'break', [], { origin: [BuiltInProcName.Break],  returns: [], reads: [NodeId.toBuiltIn('break')], cds: [{ id: '13' }, { id: '11', when: true }], environment: defaultEnv().defineVariable('x', '5', '7') })
					.calls('9', NodeId.toBuiltIn('break'))
					.argument('11', '8')
					.argument('11', '9')
					.call('11', 'if', [argumentInCall('8'), argumentInCall('9', { cds: [{ id: '13' }, { id: '11', when: true }] }), EmptyArgument], { origin: [BuiltInProcName.IfThenElse], returns: ['9'], reads: [NodeId.toBuiltIn('if'), '8'], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '5', '7'), cds: [{ id: '13' }, { id: '11', when: false }] })
					.calls('11', NodeId.toBuiltIn('if'))
					.argument('12', '7')
					.argument('12', '11')
					.call('12', '{', [argumentInCall('7'), argumentInCall('11')], {  origin: [BuiltInProcName.ExpressionList], returns: ['11'], reads: [NodeId.toBuiltIn('{')], environment: defaultEnv().defineVariable('x', '5', '7'), cds: [{ id: '13' }, { id: '11', when: true }] })
					.calls('12', NodeId.toBuiltIn('{'))
					.argument('13', '12')
					.call('13', 'repeat', [argumentInCall('12')], { origin: [BuiltInProcName.RepeatLoop], returns: [], reads: [NodeId.toBuiltIn('repeat')], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('13', NodeId.toBuiltIn('repeat'))
					.nse('13', '12')
					.argument('17', '15')
					.reads('17', '15')
					.call('17', 'print', [argumentInCall('15')], {  origin: [BuiltInProcName.Default], returns: ['15'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '5', '7') })
					.calls('17', NodeId.toBuiltIn('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('6', { cds: [{ id: '13' }, { id: '11', when: true }] })
					.defineVariable('5', 'x', { definedBy: ['6', '7'], cds: [{ id: '13' }, { id: '11', when: true }] })
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
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { origin: [BuiltInProcName.Assignment], returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
					.calls('2', NodeId.toBuiltIn('<-'))
					.argument('2', ['1', '0'])
					.call('7', '<-', [argumentInCall('5'), argumentInCall('6')], { origin: [BuiltInProcName.Assignment], returns: ['5'], reads: [NodeId.toBuiltIn('<-'), 6], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2'), cds: [{ id: '15' }] })
					.calls('7', NodeId.toBuiltIn('<-'))
					.argument('7', ['6', '5'])
					.call('8', 'next', [], { origin: [BuiltInProcName.Default], returns: [], reads: [NodeId.toBuiltIn('next')], environment: defaultEnv().defineVariable('x', '5', '7'), cds: [{ id: '15' }] })
					.calls('8', NodeId.toBuiltIn('next'))
					.argument('14', '7')
					.call('14', '{', [argumentInCall('7')], { origin: [BuiltInProcName.ExpressionList], returns: [], reads: [NodeId.toBuiltIn('{')], environment: defaultEnv().defineVariable('x', '0', '2'), cds: [{ id: '15' }] })
					.calls('14', NodeId.toBuiltIn('{'))
					.argument('15', '14')
					.call('15', 'repeat', [argumentInCall('14')], { origin: [BuiltInProcName.RepeatLoop], returns: [], reads: [NodeId.toBuiltIn('repeat')], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('15', NodeId.toBuiltIn('repeat'))
					.nse('15', '14')
					.argument('19', '17')
					.reads('19', '17')
					.call('19', 'print', [argumentInCall('17')], { origin: [BuiltInProcName.Default], returns: ['17'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '5', '7') })
					.calls('19', NodeId.toBuiltIn('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('6', { cds: [{ id: '15' }] })
					.defineVariable('5', 'x', { definedBy: ['6', '7'], cds: [{ id: '15' }] })
					.markIdForUnknownSideEffects('19')
			);
		});

		describe('for', () => {
			assertDataflow(label('Break immediately (for)', ['for-loop', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments']),
				shell, `x <- 1
for(i in 1:100) {
   x <- 2;
   break
}
print(x)`, emptyGraph()
					.use('16', 'x')
					.reads('16', ['0', '9'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
					.calls('2', NodeId.toBuiltIn('<-'))
					.argument('2', ['1', '0'])
					.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', NodeId.toBuiltIn(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('6', NodeId.toBuiltIn(':'))
					.argument('6', ['4', '5'])
					.call('11', '<-', [argumentInCall('9', { cds: [] }), argumentInCall('10', { cds: [{ id: '14' }] })], { returns: ['9'], reads: [NodeId.toBuiltIn('<-'), 10], onlyBuiltIn: true, cds: [{ id: '14', when: true }] })
					.calls('11', NodeId.toBuiltIn('<-'))
					.argument('11', ['10', '9'])
					.call('12', 'break', [], { origin: [BuiltInProcName.Break], returns: [], reads: [NodeId.toBuiltIn('break')], cds: [{ id: '14', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '14', when: true }]) })
					.calls('12', NodeId.toBuiltIn('break'))
					.argument('13', '11')
					.argument('13', '12')
					.call('13', '{', [argumentInCall('11', { cds: [] }), argumentInCall('12', { cds: [] })], { returns: [], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '14', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '14', when: true }]) })
					.calls('13', NodeId.toBuiltIn('{'))
					.argument('14', '6')
					.argument('14', '13')
					.call('14', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('13', { cds: [] })], { returns: [], reads: ['6', NodeId.toBuiltIn('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '14') })
					.calls('14', NodeId.toBuiltIn('for'))
					.argument('14', '3')
					.nse('14', '13')
					.argument('18', '16')
					.reads('18', '16')
					.call('18', 'print', [argumentInCall('16')], { returns: ['16'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '14') })
					.calls('18', NodeId.toBuiltIn('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.defineVariable('3', 'i', { definedBy: ['6'] })
					.constant('4')
					.constant('5')
					.constant('10')
					.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [ { id: '14', when: true }] })
					.markIdForUnknownSideEffects('18')
			);
			assertDataflow(label('Break in condition (for)', ['for-loop', 'name-normal', 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments', 'if']),
				shell, `x <- 1
for(i in 1:100) {
   x <- 2;
   if(foo) 
      break
}
print(x)`,  emptyGraph()
					.use('12', 'foo', { cds: [{ id: '17', when: true }, { id: '15', when: false }] })
					.use('19', 'x')
					.reads('19', ['0', '9'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
					.calls('2', NodeId.toBuiltIn('<-'))
					.argument('2', ['1', '0'])
					.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', NodeId.toBuiltIn(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('6', NodeId.toBuiltIn(':'))
					.argument('6', ['4', '5'])
					.call('11', '<-', [argumentInCall('9', { cds: [] }), argumentInCall('10', { cds: [{ id: '17', when: true }, { id: '15', when: false }] })], { returns: ['9'], reads: [NodeId.toBuiltIn('<-'), 10], onlyBuiltIn: true, cds: [{ id: '17', when: true }, { id: '15', when: false }] })
					.calls('11', NodeId.toBuiltIn('<-'))
					.argument('11', ['10', '9'])
					.call('13', 'break', [], { origin: [BuiltInProcName.Break], returns: [], reads: [NodeId.toBuiltIn('break')], cds: [{ id: '15', when: true }, { id: '17', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '17', when: true }]) })
					.calls('13', NodeId.toBuiltIn('break'))
					.argument('15', '12')
					.argument('15', '13')
					.call('15', 'if', [argumentInCall('12', { cds: [] }), argumentInCall('13', { cds: [] }), EmptyArgument], { returns: ['13'], reads: ['12', NodeId.toBuiltIn('if')], onlyBuiltIn: true, cds: [{ id: '17', when: true }, { id: '15', when: false }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '17', when: true }, { id: '15', when: false }]) })
					.calls('15', NodeId.toBuiltIn('if'))
					.argument('16', '11')
					.argument('16', '15')
					.call('16', '{', [argumentInCall('11', { cds: [{ id: '17', when: true }, { id: '15', when: false }] }), argumentInCall('15', { cds: [] })], { returns: ['15'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '17', when: true }, { id: '15', when: false }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '17', when: true }, { id: '15', when: false }]) })
					.calls('16', NodeId.toBuiltIn('{'))
					.argument('17', '6')
					.argument('17', '16')
					.call('17', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('16', { cds: [] })], { returns: [], reads: ['6', NodeId.toBuiltIn('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '17') })
					.calls('17', NodeId.toBuiltIn('for'))
					.argument('17', '3')
					.nse('17', '16')
					.argument('21', '19')
					.reads('21', '19')
					.call('21', 'print', [argumentInCall('19')], { returns: ['19'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('i', '3', '17') })
					.calls('21', NodeId.toBuiltIn('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.defineVariable('3', 'i', { definedBy: ['6'] })
					.constant('4')
					.constant('5')
					.constant('10')
					.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [ { id: '17', when: true }, { id: '15', when: false } ] })
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
					.reads('21', ['0', '9'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
					.calls('2', NodeId.toBuiltIn('<-'))
					.argument('2', ['1', '0'])
					.call('6', ':', [argumentInCall('4'), argumentInCall('5')], { returns: [], reads: ['4', '5', NodeId.toBuiltIn(':')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('6', NodeId.toBuiltIn(':'))
					.argument('6', ['4', '5'])
					.call('11', '<-', [argumentInCall('9', { cds: [] }), argumentInCall('10', { cds: [{ id: '19', when: true }] })], { returns: ['9'], reads: [NodeId.toBuiltIn('<-'), 10], onlyBuiltIn: true, cds: [{ id: '19', when: true }] })
					.calls('11', NodeId.toBuiltIn('<-'))
					.argument('11', ['10', '9'])
					.call('12', 'next', [], { returns: [], reads: [NodeId.toBuiltIn('next')], cds: [{ id: '19', when: true }], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '19', when: true }]) })
					.calls('12', NodeId.toBuiltIn('next'))
					.argument('18', '11')
					.call('18', '{', [argumentInCall('11', { cds: [] })], { returns: [], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '19', when: true }] })
					.calls('18', NodeId.toBuiltIn('{'))
					.argument('19', '6')
					.argument('19', '18')
					.call('19', 'for', [argumentInCall('3'), argumentInCall('6'), argumentInCall('18', { cds: [] })], { returns: [], reads: ['6', NodeId.toBuiltIn('for')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('x', '14', '16', []).defineVariable('i', '3', '19') })
					.calls('19', NodeId.toBuiltIn('for'))
					.argument('19', '3')
					.nse('19', '18')
					.argument('23', '21')
					.reads('23', '21')
					.call('23', 'print', [argumentInCall('21')], { returns: ['21'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '9', '11', []).defineVariable('x', '14', '16', []).defineVariable('i', '3', '19') })
					.calls('23', NodeId.toBuiltIn('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.defineVariable('3', 'i', { definedBy: ['6'] })
					.constant('4')
					.constant('5')
					.constant('10')
					.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [{ id: 19, when: true }] })
					.markIdForUnknownSideEffects('23')
			);
		});

		describe('while', () => {
			assertDataflow(label('Break immediately (while)', ['while-loop', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments']),
				shell, `x <- 1
while(TRUE) {
   x <- 2;
   break
}
print(x)`,  emptyGraph()
					.use('13', 'x')
					.reads('13', ['6'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
					.calls('2', NodeId.toBuiltIn('<-'))
					.argument('2', ['1', '0'])
					.call('8', '<-', [argumentInCall('6', { cds: [] }), argumentInCall('7', { cds: [{ id: '11', when: true }] })], { returns: ['6'], reads: [NodeId.toBuiltIn('<-'), 7], onlyBuiltIn: true, cds: [{ id: 11, when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('8', NodeId.toBuiltIn('<-'))
					.argument('8', ['7', '6'])
					.call('9', 'break', [], { origin: [BuiltInProcName.Break], returns: [], reads: [NodeId.toBuiltIn('break')], cds: [{ id: 11, when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '11', when: true }]) })
					.calls('9', NodeId.toBuiltIn('break'))
					.argument('10', '8')
					.argument('10', '9')
					.call('10', '{', [argumentInCall('8', { cds: [] }), argumentInCall('9', { cds: [] })], { returns: [], reads: [NodeId.toBuiltIn('{')], cds: [{ id: 11, when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '11', when: true }]) })
					.calls('10', NodeId.toBuiltIn('{'))
					.argument('11', '10')
					.call('11', 'while', [argumentInCall('3'), argumentInCall('10', { cds: [] })], { returns: [], reads: ['3', NodeId.toBuiltIn('while')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '11', when: true }]) })
					.calls('11', NodeId.toBuiltIn('while'))
					.argument('11', '3')
					.nse('11', '10')
					.argument('15', '13')
					.reads('15', '13')
					.call('15', 'print', [argumentInCall('13')], { returns: ['13'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '6', '8', []) })
					.calls('15', NodeId.toBuiltIn('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('3')
					.constant('7')
					.defineVariable('6', 'x', { definedBy: ['7', '8'], cds: [{ id: 11, when: true }] })
					.markIdForUnknownSideEffects('15')
			);
			assertDataflow(label('Break in condition (while)', ['while-loop', 'name-normal', 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments', 'if']),
				shell, `x <- 1
while(TRUE) {
   x <- 2;
   if(foo) 
      break
}
print(x)`, emptyGraph()
					.use('9', 'foo', { cds: [{ id: 14, when: true }, { id: '12', when: false }] })
					.use('16', 'x')
					.reads('16', ['6'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
					.calls('2', NodeId.toBuiltIn('<-'))
					.argument('2', ['1', '0'])
					.call('8', '<-', [argumentInCall('6', { cds: [] }), argumentInCall('7', { cds: [{ id: '14', when: true }, { id: '12', when: false }] })], { returns: ['6'], reads: [NodeId.toBuiltIn('<-'), 7], onlyBuiltIn: true, cds: [{ id: 14, when: true }, { id: '12', when: false }], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('8', NodeId.toBuiltIn('<-'))
					.argument('8', ['7', '6'])
					.call('10', 'break', [], { origin: [BuiltInProcName.Break], returns: [], reads: [NodeId.toBuiltIn('break')], cds: [{ id: '12', when: true }, { id: 14, when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }]) })
					.calls('10', NodeId.toBuiltIn('break'))
					.argument('12', '9')
					.argument('12', '10')
					.call('12', 'if', [argumentInCall('9', { cds: [] }), argumentInCall('10', { cds: [] }), EmptyArgument], { returns: ['10'], reads: [NodeId.toBuiltIn('if'), '9'], onlyBuiltIn: true, cds: [{ id: 14, when: true }, { id: '12', when: false }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }, { id: '12', when: true }]) })
					.calls('12', NodeId.toBuiltIn('if'))
					.argument('13', '8')
					.argument('13', '12')
					.call('13', '{', [argumentInCall('8', { cds: [] }), argumentInCall('12', { cds: [] })], { returns: ['12'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: 14, when: true }, { id: '12', when: false }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }, { id: '12', when: true }]) })
					.calls('13', NodeId.toBuiltIn('{'))
					.argument('14', '13')
					.call('14', 'while', [argumentInCall('3'), argumentInCall('13', { cds: [] })], { returns: [], reads: ['3', NodeId.toBuiltIn('while')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '14', when: true }, { id: '12', when: true }]) })
					.calls('14', NodeId.toBuiltIn('while'))
					.argument('14', '3')
					.nse('14', '13')
					.argument('18', '16')
					.reads('18', '16')
					.call('18', 'print', [argumentInCall('16')], { returns: ['16'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '6', '8', []) })
					.calls('18', NodeId.toBuiltIn('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('3')
					.constant('7')
					.defineVariable('6', 'x', { definedBy: ['7', '8'], cds: [{ id: 14, when: true }, { id: '12', when: false }] })
					.markIdForUnknownSideEffects('18')
			);
			assertDataflow(label('Next (while)', ['while-loop', 'newlines', 'name-normal', 'numbers', 'next', 'semicolons', 'unnamed-arguments']),
				shell, `x <- 1
while(TRUE) {
   x <- 2;
   next;
   x <- 3;
}
print(x)`, emptyGraph()
					.use('18', 'x')
					.reads('18', ['6'])
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
					.calls('2', NodeId.toBuiltIn('<-'))
					.argument('2', ['1', '0'])
					.call('8', '<-', [argumentInCall('6', { cds: [] }), argumentInCall('7', { cds: [{ id: '16', when: true }] })], { returns: ['6'], reads: [NodeId.toBuiltIn('<-'), 7], onlyBuiltIn: true, cds: [{ id: 16, when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
					.calls('8', NodeId.toBuiltIn('<-'))
					.argument('8', ['7', '6'])
					.call('9', 'next', [], { returns: [], reads: [NodeId.toBuiltIn('next')], cds: [{ id: 16, when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]) })
					.calls('9', NodeId.toBuiltIn('next'))
					.argument('15', '8')
					.call('15', '{', [argumentInCall('8', { cds: [{ id: 16, when: true }] })], { returns: [], reads: [NodeId.toBuiltIn('{')], cds: [{ id: 16, when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]).defineVariable('x', '11', '13', []) })
					.calls('15', NodeId.toBuiltIn('{'))
					.argument('16', '15')
					.call('16', 'while', [argumentInCall('3'), argumentInCall('15', { cds: [] })], { returns: [], reads: ['3', NodeId.toBuiltIn('while')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', [{ id: '16', when: true }]).defineVariable('x', '11', '13', []) })
					.calls('16', NodeId.toBuiltIn('while'))
					.argument('16', '3')
					.nse('16', '15')
					.argument('20', '18')
					.reads('20', '18')
					.call('20', 'print', [argumentInCall('18')], { returns: ['18'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '0', '2', []).defineVariable('x', '6', '8', []).defineVariable('x', '11', '13', []) })
					.calls('20', NodeId.toBuiltIn('print'))
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
					.constant('3')
					.constant('7')
					.defineVariable('6', 'x', { definedBy: ['7', '8'], cds: [{ id: '16', when: true }] })
					.markIdForUnknownSideEffects('20')
			);
		});
	});
}));
