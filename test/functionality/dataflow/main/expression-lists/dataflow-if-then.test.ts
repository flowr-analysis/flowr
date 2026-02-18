import { assertDataflow, withShell } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { EmptyArgument } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { MIN_VERSION_LAMBDA } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions';
import { ReferenceType } from '../../../../../src/dataflow/environments/identifier';
import { describe } from 'vitest';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe.sequential('Lists with if-then constructs', withShell(shell => {
	for(const assign of ['<-', '<<-', '=']) {
		describe(`using ${assign}`, () => {
			describe('reads within if', () => {
				for(const b of [
					{ label: 'without else', text: '' },
					{ label: 'with else', text: ' else { 1 }' },
				]) {
					describe(`${b.label}`, () => {
						const cd = b.text === '' ? [{ id: '8', when: true }] : [{ id: '12', when: true }];
						const baseGraph = emptyGraph()
							.use('3', 'x')
							.reads('3', '0')
							.call('2', assign, [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn(assign), 1], onlyBuiltIn: true })
							.calls('2', NodeId.toBuiltIn(assign))
							.call('7', '{', [argumentInCall('6')], { returns: ['6'], reads: [NodeId.toBuiltIn('{')], cds: cd, environment: defaultEnv().defineVariable('x', '0', '2') })
							.calls('7', NodeId.toBuiltIn('{'));

						if(b.text !== '') {
							baseGraph
								.call('11', '{', [argumentInCall('10')], { returns: ['10'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '12', when: false }], environment: defaultEnv().defineVariable('x', '0', '2') })
								.calls('11', NodeId.toBuiltIn('{'))
								.call('12', 'if', [argumentInCall('3'), argumentInCall('7'), argumentInCall('11')], { returns: ['7', '11'], reads: ['3', NodeId.toBuiltIn('if')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
								.calls('12', NodeId.toBuiltIn('if'))
								.constant('1')
								.defineVariable('0', 'x', { definedBy: ['1', '2'] })
								.constant('6', { cds: [{ id: '12', when: true }] })
								.constant('10', { cds: [{ id: '12', when: false }] });
						} else {
							baseGraph.call('8', 'if', [argumentInCall('3'), argumentInCall('7'), EmptyArgument], { returns: ['7'], reads: ['3', NodeId.toBuiltIn('if')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
								.calls('8', NodeId.toBuiltIn('if'))
								.constant('1')
								.defineVariable('0', 'x', { definedBy: ['1', '2'] })
								.constant('6', { cds: [{ id: '8', when: true }] });
						}
						assertDataflow(label('read previous def in cond', [...OperatorDatabase[assign].capabilities, 'name-normal', 'numbers', 'newlines', 'if']),
							shell,
							`x ${assign} 2\nif(x) { 1 } ${b.text}`,
							baseGraph
						);
						const previousGraph = emptyGraph()
							.use('6', 'x')
							.reads('6', '0')
							.call('2', assign, [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn(assign), 1], onlyBuiltIn: true })
							.calls('2', NodeId.toBuiltIn(assign))
							.call('7', '{', [argumentInCall('6')], { returns: ['6'], reads: [NodeId.toBuiltIn('{')], environment: defaultEnv().defineVariable('x', '0', '2') })
							.calls('7', NodeId.toBuiltIn('{'))
							.call(cd[0].id, 'if', [argumentInCall('3'), argumentInCall('7'), EmptyArgument], { returns: ['7'], reads: ['3', NodeId.toBuiltIn('if')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
							.calls(cd[0].id, NodeId.toBuiltIn('if'))
							.constant('1')
							.defineVariable('0', 'x', { definedBy: ['1', '2'] })
							.constant('3');
						// otherwise will be pruned by TRUE
						assertDataflow(label('read previous def in then', [...OperatorDatabase[assign].capabilities, 'name-normal', 'numbers', 'newlines', 'if', 'logical']),
							shell,
							`x ${assign} 2\nif(TRUE) { x } ${b.text}`,
							previousGraph
						);
					});
				}
				assertDataflow(label('read previous def in else', [...OperatorDatabase[assign].capabilities, 'name-normal', 'numbers', 'newlines', 'if', 'logical']),
					shell,
					`x ${assign} 2\nif(FALSE) { 42 } else { x }`,  emptyGraph()
						.use('10', 'x')
						.reads('10', '0')
						.call('2', assign, [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn(assign), 1], onlyBuiltIn: true })
						.calls('2', NodeId.toBuiltIn(assign))
						.call('11', '{', [argumentInCall('10')], { returns: ['10'], reads: [NodeId.toBuiltIn('{')], environment: defaultEnv().defineVariable('x', '0', '2') })
						.calls('11', NodeId.toBuiltIn('{'))
						.call('12', 'if', [argumentInCall('3'), EmptyArgument, argumentInCall('11')], { returns: ['11'], reads: ['3', NodeId.toBuiltIn('if')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
						.calls('12', NodeId.toBuiltIn('if'))
						.constant('1')
						.defineVariable('0', 'x', { definedBy: ['1', '2'] })
						.constant('3')
				);
			});
			describe('write within if', () => {
				assertDataflow(label('without else directly together', ['if', 'logical', 'name-normal', ...OperatorDatabase[assign].capabilities, 'numbers', 'newlines']),
					shell,
					`if(TRUE) { x ${assign} 2 }\nx`, emptyGraph()
						.use('8', 'x')
						.reads('8', '3')
						.call('5', assign, [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [NodeId.toBuiltIn(assign), 4], onlyBuiltIn: true })
						.calls('5', NodeId.toBuiltIn(assign))
						.call('6', '{', [argumentInCall('5')], { returns: ['5'], reads: [NodeId.toBuiltIn('{')] })
						.calls('6', NodeId.toBuiltIn('{'))
						.call('7', 'if', [argumentInCall('0'), argumentInCall('6'), EmptyArgument], { returns: ['6'], reads: ['0', NodeId.toBuiltIn('if')], onlyBuiltIn: true })
						.calls('7', NodeId.toBuiltIn('if'))
						.constant('0')
						.constant('4')
						.defineVariable('3', 'x', { definedBy: ['4', '5'] })
				);
				assertDataflow(label('def in else read afterwards', ['if', 'logical', 'numbers', 'name-normal', ...OperatorDatabase[assign].capabilities, 'newlines']),
					shell,
					`if(FALSE) { 42 } else { x ${assign} 5 }\nx`,  emptyGraph()
						.use('12', 'x')
						.reads('12', '7')
						.call('9', assign, [argumentInCall('7'), argumentInCall('8')], { returns: ['7'], reads: [NodeId.toBuiltIn(assign), 8], onlyBuiltIn: true })
						.calls('9', NodeId.toBuiltIn(assign))
						.call('10', '{', [argumentInCall('9')], { returns: ['9'], reads: [NodeId.toBuiltIn('{')] })
						.calls('10', NodeId.toBuiltIn('{'))
						.call('11', 'if', [argumentInCall('0'), EmptyArgument, argumentInCall('10')], { returns: ['10'], reads: ['0', NodeId.toBuiltIn('if')], onlyBuiltIn: true })
						.calls('11', NodeId.toBuiltIn('if'))
						.constant('0')
						.constant('8')
						.defineVariable('7', 'x', { definedBy: ['8', '9'] })
				);

				assertDataflow(label('def in then and else read afterward', ['if', 'name-normal', ...OperatorDatabase[assign].capabilities, 'numbers', 'newlines']),
					shell,
					`if(z) { x ${assign} 7 } else { x ${assign} 5 }\nx`,  emptyGraph()
						.use('0', 'z')
						.use('14', 'x')
						.reads('14', ['3', '9'])
						.call('5', assign, [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [NodeId.toBuiltIn(assign), 4], onlyBuiltIn: true, cds: [{ id: '13', when: true }] })
						.calls('5', NodeId.toBuiltIn(assign))
						.call('6', '{', [argumentInCall('5')], { returns: ['5'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '13', when: true }] })
						.calls('6', NodeId.toBuiltIn('{'))
						.call('11', assign, [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [NodeId.toBuiltIn(assign), 10], onlyBuiltIn: true, cds: [{ id: '13', when: false }] })
						.calls('11', NodeId.toBuiltIn(assign))
						.call('12', '{', [argumentInCall('11')], { returns: ['11'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '13', when: false }] })
						.calls('12', NodeId.toBuiltIn('{'))
						.call('13', 'if', [argumentInCall('0'), argumentInCall('6'), argumentInCall('12')], { returns: ['6', '12'], reads: ['0', NodeId.toBuiltIn('if')], onlyBuiltIn: true })
						.calls('13', NodeId.toBuiltIn('if'))
						.constant('4')
						.defineVariable('3', 'x', { definedBy: ['4', '5'], cds: [{ id: '13', when: true }] })
						.constant('10')
						.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [{ id: '13', when: false }] })
				);
			});
		});
	}
	describe('Branch Coverage', () => {
		//All test related to branch coverage (testing the interaction between then end else block)
		assertDataflow(label('assignment both branches in if', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'if']), shell, 'x <- 1\nif(r) { x <- 2 } else { x <- 3 }\n y <- x',  emptyGraph()
			.use('3', 'r')
			.use('18', 'x')
			.reads('18', ['6', '12'])
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
			.calls('2', NodeId.toBuiltIn('<-'))
			.call('8', '<-', [argumentInCall('6'), argumentInCall('7')], { returns: ['6'], reads: [NodeId.toBuiltIn('<-'), 7], onlyBuiltIn: true, cds: [{ id: '16', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('8', NodeId.toBuiltIn('<-'))
			.call('9', '{', [argumentInCall('8')], { returns: ['8'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '16', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('9', NodeId.toBuiltIn('{'))
			.call('14', '<-', [argumentInCall('12'), argumentInCall('13')], { returns: ['12'], reads: [NodeId.toBuiltIn('<-'), 13], onlyBuiltIn: true, cds: [{ id: '16', when: false }], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('14', NodeId.toBuiltIn('<-'))
			.call('15', '{', [argumentInCall('14')], { returns: ['14'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '16', when: false }], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('15', NodeId.toBuiltIn('{'))
			.call('16', 'if', [argumentInCall('3'), argumentInCall('9'), argumentInCall('15')], { returns: ['9', '15'], reads: ['3', NodeId.toBuiltIn('if')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('16', NodeId.toBuiltIn('if'))
			.call('19', '<-', [argumentInCall('17'), argumentInCall('18')], { returns: ['17'], reads: [NodeId.toBuiltIn('<-'), 18], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '6', '8', [{ id: '16', when: false }]).defineVariable('x', '12', '14', [{ id: '16', when: false }]) })
			.calls('19', NodeId.toBuiltIn('<-'))
			.constant('1')
			.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			.constant('7')
			.defineVariable('6', 'x', { definedBy: ['7', '8'], cds: [{ id: '16', when: true }] })
			.constant('13')
			.defineVariable('12', 'x', { definedBy: ['13', '14'], cds: [{ id: '16', when: false }] })
			.defineVariable('17', 'y', { definedBy: ['18', '19'] })
		);

		assertDataflow(label('assignment if one branch', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'if', 'numbers']), shell, 'x <- 1\nif(r) { x <- 2 } \n y <- x',  emptyGraph()
			.use('3', 'r')
			.use('12', 'x')
			.reads('12', ['6', '0'])
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
			.calls('2', NodeId.toBuiltIn('<-'))
			.call('8', '<-', [argumentInCall('6'), argumentInCall('7')], { returns: ['6'], reads: [NodeId.toBuiltIn('<-'), 7], onlyBuiltIn: true, cds: [{ id: '10', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('8', NodeId.toBuiltIn('<-'))
			.call('9', '{', [argumentInCall('8')], { returns: ['8'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '10', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('9', NodeId.toBuiltIn('{'))
			.call('10', 'if', [argumentInCall('3'), argumentInCall('9'), EmptyArgument], { returns: ['9'], reads: ['3', NodeId.toBuiltIn('if')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', [{ id: '10', when: true }]) })
			.calls('10', NodeId.toBuiltIn('if'))
			.call('13', '<-', [argumentInCall('11'), argumentInCall('12')], { returns: ['11'], reads: [NodeId.toBuiltIn('<-'), 12], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '6', '8', [{ id: '10', when: true }]).defineVariable('x', '0', '2', [{ id: '10', when: true }]) })
			.calls('13', NodeId.toBuiltIn('<-'))
			.constant('1')
			.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			.constant('7')
			.defineVariable('6', 'x', { definedBy: ['7', '8'], cds: [{ id: '10', when: true }] })
			.defineVariable('11', 'y', { definedBy: ['12', '13'] })
		);

		assertDataflow(label('assignment if multiple variables with else', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'if']),
			shell,
			'x <- 1 \n y <- 2 \n if(r){ x <- 3 \n y <- 4} else {x <- 5} \n w <- x \n z <- y',
			emptyGraph()
				.use('6', 'r')
				.use('24', 'x')
				.reads('24', ['9', '18'])
				.use('27', 'y')
				.reads('27', ['12', '3'])
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
				.calls('2', NodeId.toBuiltIn('<-'))
				.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [NodeId.toBuiltIn('<-'), 4], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
				.calls('5', NodeId.toBuiltIn('<-'))
				.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [NodeId.toBuiltIn('<-'), 10], onlyBuiltIn: true, cds: [{ id: '22', when: true }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.calls('11', NodeId.toBuiltIn('<-'))
				.call('14', '<-', [argumentInCall('12'), argumentInCall('13')], { returns: ['12'], reads: [NodeId.toBuiltIn('<-'), 13], onlyBuiltIn: true, cds: [{ id: '22', when: true }], environment: defaultEnv().defineVariable('x', '9', '11').defineVariable('y', '3', '5') })
				.calls('14', NodeId.toBuiltIn('<-'))
				.call('15', '{', [argumentInCall('11'), argumentInCall('14')], { returns: ['14'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '22', when: true }], environment: defaultEnv().defineVariable('x', '9', '11').defineVariable('y', '3', '5') })
				.calls('15', NodeId.toBuiltIn('{'))
				.call('20', '<-', [argumentInCall('18'), argumentInCall('19')], { returns: ['18'], reads: [NodeId.toBuiltIn('<-'), 19], onlyBuiltIn: true, cds: [{ id: '22', when: false }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.calls('20', NodeId.toBuiltIn('<-'))
				.call('21', '{', [argumentInCall('20')], { returns: ['20'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '22', when: false }], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.calls('21', NodeId.toBuiltIn('{'))
				.call('22', 'if', [argumentInCall('6'), argumentInCall('15'), argumentInCall('21')], { returns: ['15', '21'], reads: ['6', NodeId.toBuiltIn('if')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.calls('22', NodeId.toBuiltIn('if'))
				.call('25', '<-', [argumentInCall('23'), argumentInCall('24')], { returns: ['23'], reads: [NodeId.toBuiltIn('<-'), 24], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '22', when: false }]).defineVariable('x', '18', '20', [{ id: '22', when: false }]).defineVariable('y', '12', '14', [{ id: '22', when: true }]).defineVariable('y', '3', '5', [{ id: '22', when: true }]) })
				.calls('25', NodeId.toBuiltIn('<-'))
				.call('28', '<-', [argumentInCall('26'), argumentInCall('27')], { returns: ['26'], reads: [NodeId.toBuiltIn('<-'), 27], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '22', when: false }]).defineVariable('x', '18', '20', [{ id: '22', when: false }]).defineVariable('y', '12', '14', [{ id: '22', when: true }]).defineVariable('y', '3', '5', [{ id: '22', when: true }]).defineVariable('w', '23', '25') })
				.calls('28', NodeId.toBuiltIn('<-'))
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.constant('4')
				.defineVariable('3', 'y', { definedBy: ['4', '5'] })
				.constant('10')
				.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [{ id: '22', when: true }] })
				.constant('13')
				.defineVariable('12', 'y', { definedBy: ['13', '14'], cds: [{ id: '22', when: true }] })
				.constant('19')
				.defineVariable('18', 'x', { definedBy: ['19', '20'], cds: [{ id: '22', when: false }] })
				.defineVariable('23', 'w', { definedBy: ['24', '25'] })
				.defineVariable('26', 'z', { definedBy: ['27', '28'] })
		);
		assertDataflow(label('assignment in else block', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'if']), shell, 'x <- 1 \n if(r){} else{x <- 2} \n y <- x',  emptyGraph()
			.use('3', 'r')
			.use('15', 'x')
			.reads('15', ['0', '9'])
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
			.calls('2', NodeId.toBuiltIn('<-'))
			.call('6', '{', [], { returns: [], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '13', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('6', NodeId.toBuiltIn('{'))
			.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [NodeId.toBuiltIn('<-'), 10], onlyBuiltIn: true, cds: [{ id: '13', when: false }], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('11', NodeId.toBuiltIn('<-'))
			.call('12', '{', [argumentInCall('11')], { returns: ['11'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '13', when: false }], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('12', NodeId.toBuiltIn('{'))
			.call('13', 'if', [argumentInCall('3'), argumentInCall('6'), argumentInCall('12')], { returns: ['6', '12'], reads: ['3', NodeId.toBuiltIn('if')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', [{ id: '13', when: false }]).defineVariable('x', '9', '11', [{ id: '13', when: false }]) })
			.calls('13', NodeId.toBuiltIn('if'))
			.call('16', '<-', [argumentInCall('14'), argumentInCall('15')], { returns: ['14'], reads: [NodeId.toBuiltIn('<-'), 15], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', [{ id: '13', when: false }]).defineVariable('x', '9', '11', [{ id: '13', when: false }]) })
			.calls('16', NodeId.toBuiltIn('<-'))
			.constant('1')
			.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			.constant('10')
			.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [{ id: '13', when: false }] })
			.defineVariable('14', 'y', { definedBy: ['15', '16'] })
		);
		assertDataflow(label('nested if else', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'if', 'unnamed-arguments']),
			shell, `x <- 1
if(y) {
  if(z) {
    x <- 3
  } else {
    x <- 2
  }
} else {
  x <- 4
}
print(x)`,  emptyGraph()
				.use('3', 'y')
				.use('6', 'z', { cds: [{ id: '27', when: true }] })
				.use('29', 'x')
				.reads('29', ['9', '15', '23'])
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
				.calls('2', NodeId.toBuiltIn('<-'))
				.argument('2', ['1', '0'])
				.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [NodeId.toBuiltIn('<-'), 10], onlyBuiltIn: true, cds: [{ id: '19', when: true }, { id: '27', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
				.calls('11', NodeId.toBuiltIn('<-'))
				.argument('11', ['10', '9'])
				.argument('12', '11')
				.call('12', '{', [argumentInCall('11')], { returns: ['11'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '19', when: true }, { id: '27', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
				.calls('12', NodeId.toBuiltIn('{'))
				.call('17', '<-', [argumentInCall('15'), argumentInCall('16')], { returns: ['15'], reads: [NodeId.toBuiltIn('<-'), 16], onlyBuiltIn: true, cds: [{ id: '19', when: false }, { id: '27', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
				.calls('17', NodeId.toBuiltIn('<-'))
				.argument('17', ['16', '15'])
				.argument('18', '17')
				.call('18', '{', [argumentInCall('17')], { returns: ['17'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '19', when: false }, { id: '27', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
				.calls('18', NodeId.toBuiltIn('{'))
				.argument('19', '6')
				.argument('19', '12')
				.argument('19', '18')
				.call('19', 'if', [argumentInCall('6'), argumentInCall('12'), argumentInCall('18')], { returns: ['12', '18'], reads: ['6', NodeId.toBuiltIn('if')], onlyBuiltIn: true, cds: [{ id: '27', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
				.calls('19', NodeId.toBuiltIn('if'))
				.argument('20', '19')
				.call('20', '{', [argumentInCall('19')], { returns: ['19'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '27', when: true }], environment: defaultEnv().defineVariable('x', '0', '2') })
				.calls('20', NodeId.toBuiltIn('{'))
				.call('25', '<-', [argumentInCall('23'), argumentInCall('24')], { returns: ['23'], reads: [NodeId.toBuiltIn('<-'), 24], onlyBuiltIn: true, cds: [{ id: '27', when: false }], environment: defaultEnv().defineVariable('x', '0', '2') })
				.calls('25', NodeId.toBuiltIn('<-'))
				.argument('25', ['24', '23'])
				.argument('26', '25')
				.call('26', '{', [argumentInCall('25')], { returns: ['25'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '27', when: false }], environment: defaultEnv().defineVariable('x', '0', '2') })
				.calls('26', NodeId.toBuiltIn('{'))
				.argument('27', '3')
				.argument('27', '20')
				.argument('27', '26')
				.call('27', 'if', [argumentInCall('3'), argumentInCall('20'), argumentInCall('26')], { returns: ['20', '26'], reads: ['3', NodeId.toBuiltIn('if')], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
				.calls('27', NodeId.toBuiltIn('if'))
				.argument('31', '29')
				.reads('31', '29')
				.call('31', 'print', [argumentInCall('29')], { returns: ['29'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '9', '11', [{ id: '27', when: false }]).defineVariable('x', '15', '17', [{ id: '27', when: false }]).defineVariable('x', '23', '25', [{ id: '27', when: false }]) })
				.calls('31', NodeId.toBuiltIn('print'))
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.constant('10')
				.defineVariable('9', 'x', { definedBy: ['10', '11'], cds: [{ id: '19', when: true }, { id: '27', when: true }] })
				.constant('16')
				.defineVariable('15', 'x', { definedBy: ['16', '17'], cds: [{ id: '19', when: false }, { id: '27', when: true }] })
				.constant('24')
				.defineVariable('23', 'x', { definedBy: ['24', '25'], cds: [{ id: '27', when: false }] })
				.markIdForUnknownSideEffects('31')
		);
	});
	describe('Get and assign', () => {
		assertDataflow(label('assign in condition', ['name-normal', 'lambda-syntax', 'numbers', 'if', 'newlines', 'assignment-functions', 'strings', 'normal-definition', 'implicit-return', 'call-normal']),
			shell, `a <- \\() 2
if(y) {
   assign("a", function() 1)
}
a()`,  emptyGraph()
				.use('5', 'y')
				.call('4', '<-', [argumentInCall('0'), argumentInCall('3')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 3], onlyBuiltIn: true })
				.calls('4', NodeId.toBuiltIn('<-'))
				.argument('4', ['3', '0'])
				.call('15', 'assign', [argumentInCall('9'), argumentInCall('13')], { returns: ['9'], reads: [NodeId.toBuiltIn('assign'), 13], environment: defaultEnv().defineFunction('a', '0', '4'), onlyBuiltIn: true, cds: [{ id: '17', when: true }] })
				.calls('15', NodeId.toBuiltIn('assign'))
				.argument('15', ['13', '9'])
				.call('16', '{', [argumentInCall('15', { cds: [{ id: '17', when: true }] })], { returns: ['15'], reads: [NodeId.toBuiltIn('{')], cds: [{ id: '17', when: true }], environment: defaultEnv().defineFunction('a', '0', '4') })
				.calls('16', NodeId.toBuiltIn('{'))
				.argument('17', '5')
				.argument('17', '16')
				.call('17', 'if', [argumentInCall('5'), argumentInCall('16'), EmptyArgument], { returns: ['16'], reads: ['5', NodeId.toBuiltIn('if')], onlyBuiltIn: true, environment: defaultEnv().defineFunction('a', '0', '4', [{ id: '17', when: true }]) })
				.calls('17', NodeId.toBuiltIn('if'))
				.call('19', 'a', [], { returns: ['1', '11'], reads: ['9', '0'], environment: defaultEnv().defineFunction('a', '9', '15', [{ id: '17', when: true }]).defineFunction('a', '0', '4', [{ id: '17', when: true }]) })
				.calls('19', ['3', '13'])
				.constant('1', undefined, false)
				.defineFunction('3', ['1'], {
					out:               [],
					in:                [{ nodeId: '1', name: undefined, cds: [], type: ReferenceType.Argument }],
					unknownReferences: [],
					entryPoint:        '1',
					graph:             new Set(['1']),
					environment:       defaultEnv().pushEnv()
				})
				.defineVariable('0', 'a', { definedBy: ['3', '4'] })
				.constant('11', undefined, false)
				.defineFunction('13', ['11'], {
					out:               [],
					in:                [{ nodeId: '11', name: undefined, cds: [], type: ReferenceType.Argument }],
					unknownReferences: [],
					entryPoint:        '11',
					graph:             new Set(['11']),
					environment:       defaultEnv().pushEnv()
				})
				.defineVariable('9', '"a"', { definedBy: ['13', '15'], cds: [{ id: '17', when: true }] }),
			{ minRVersion: MIN_VERSION_LAMBDA });
		assertDataflow(label('assign from get', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'assignment-functions', 'strings', 'unnamed-arguments', 'name-created']),
			shell, 'b <- 5\nassign("a", get("b"))\nprint(a)', emptyGraph()
				.use('7', '"b"')
				.reads('7', '0')
				.use('13', 'a')
				.reads('13', '4')
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
				.calls('2', NodeId.toBuiltIn('<-'))
				.argument('2', ['1', '0'])
				.argument(9, 7)
				.returns(9, 7)
				.call('9', 'get', [argumentInCall('7')], { returns: [], reads: [NodeId.toBuiltIn('get'), '7'], onlyBuiltIn: true, environment: defaultEnv().defineVariable('b', '0', '2') })
				.calls('9', NodeId.toBuiltIn('get'))
				.argument('11', '9')
				.call('11', 'assign', [argumentInCall('4'), argumentInCall('9')], { returns: ['4'], reads: [NodeId.toBuiltIn('assign'), 9], onlyBuiltIn: true, environment: defaultEnv().defineVariable('b', '0', '2') })
				.calls('11', NodeId.toBuiltIn('assign'))
				.argument('11', '4')
				.argument('15', '13')
				.reads('15', '13')
				.call('15', 'print', [argumentInCall('13')], { returns: ['13'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('b', '0', '2').defineVariable('a', '4', '11') })
				.calls('15', NodeId.toBuiltIn('print'))
				.constant('1')
				.defineVariable('0', 'b', { definedBy: ['1', '2'] })
				.defineVariable('4', '"a"', { definedBy: ['9', '11'] })
				.markIdForUnknownSideEffects('15')
		);
		assertDataflow(label('get in function', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'empty-arguments', 'newlines', 'implicit-return', 'call-normal', 'name-created']),
			shell, `a <- 5
f <- function() {
  get("a")
}
f()`,  emptyGraph()
				.use('7', '"a"', undefined, false)
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
				.calls('2', NodeId.toBuiltIn('<-'))
				.argument(2, [1, 0])
				.argument(9, 7)
				.returns(9, 7)
				.call('9', 'get', [argumentInCall('7')], { returns: [], reads: ['7', NodeId.toBuiltIn('get')], onlyBuiltIn: true, environment: defaultEnv().pushEnv() }, false)
				.calls('9', NodeId.toBuiltIn('get'))
				.argument('10', '9')
				.call('10', '{', [argumentInCall('9')], { returns: ['9'], reads: [NodeId.toBuiltIn('{')], environment: defaultEnv().pushEnv() }, false)
				.calls('10', NodeId.toBuiltIn('{'))
				.call('12', '<-', [argumentInCall('3'), argumentInCall('11')], { returns: ['3'], reads: [NodeId.toBuiltIn('<-'), 11], onlyBuiltIn: true, environment: defaultEnv().defineVariable('a', '0', '2') })
				.calls('12', NodeId.toBuiltIn('<-'))
				.argument('12', ['11', '3'])
				.call('14', 'f', [], { returns: ['9'], reads: ['3'], environment: defaultEnv().defineVariable('a', '0', '2').defineFunction('f', '3', '12') })
				.calls('14', '11')
				.definesOnCall('14', '0')
				.definedByOnCall('7', '0')
				.constant('1')
				.defineVariable('0', 'a', { definedBy: ['1', '2'] })
				.defineFunction('11', ['9'], {
					out:               [],
					in:                [],
					unknownReferences: [],
					entryPoint:        '10',
					graph:             new Set(['7', '9', '10']),
					environment:       defaultEnv().pushEnv()
				})
				.defineVariable('3', 'f', { definedBy: ['11', '12'] })
		);
		assertDataflow(label('get in function argument', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'formals-default', 'strings', 'implicit-return', 'name-created']),
			shell, `a <- 5
f <- function(a = get("a")) {
  a
}
f()`, emptyGraph()
				.use('6', '"a"', undefined, false)
				.reads('6', '4')
				.use('12', 'a', undefined, false)
				.reads('12', '4')
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
				.calls('2', NodeId.toBuiltIn('<-'))
				.argument('2', ['1', '0'])
				.argument(8, 6)
				.returns(8, 6)
				.call('8', 'get', [argumentInCall('6')], { returns: [], reads: ['6', NodeId.toBuiltIn('get')], onlyBuiltIn: true, environment: defaultEnv().pushEnv() }, false)
				.argument('13', '12')
				.call('13', '{', [argumentInCall('12')], { returns: ['12'], reads: [NodeId.toBuiltIn('{')], environment: defaultEnv().pushEnv().defineParameter('a', '4', '9') }, false)
				.calls('13', NodeId.toBuiltIn('{'))
				.call('15', '<-', [argumentInCall('3'), argumentInCall('14')], { returns: ['3'], reads: [NodeId.toBuiltIn('<-'), 14], onlyBuiltIn: true, environment: defaultEnv().defineVariable('a', '0', '2') })
				.calls('15', NodeId.toBuiltIn('<-'))
				.argument('15', ['14', '3'])
				.call('17', 'f', [], { returns: ['12'], reads: ['3'], environment: defaultEnv().defineVariable('a', '0', '2').defineFunction('f', '3', '15') })
				.calls('17', '14')
				.constant('1')
				.defineVariable('0', 'a', { definedBy: ['1', '2'] })
				.defineVariable('4', 'a', { definedBy: ['6', '8'] }, false)
				.defineFunction('14', ['12'], {
					out:               [],
					in:                [],
					unknownReferences: [],
					entryPoint:        '13',
					graph:             new Set(['4', '6', '8', '12', '13']),
					environment:       defaultEnv().pushEnv().defineParameter('a', '4', '9')
				}, { readParams: [[4, true]] })
				.defineVariable('3', 'f', { definedBy: ['14', '15'] }));
	});
	describe('Dead Code', () => {
		assertDataflow(label('useless branch I', ['if', 'control-flow', 'built-in']),
			shell, `y <- TRUE
if(TRUE) {
	y <- FALSE
} else {
	y <- TRUE
}
print(y)`, emptyGraph()
				.defineVariable('3@y', 'y', { definedBy: ['3@y', '3@FALSE'] })
				.constant('3@FALSE'), { expectIsSubgraph: true, resolveIdsAsCriterion: true });

		assertDataflow(label('useless branch II', ['if', 'control-flow', 'built-in']),
			shell, `y <- TRUE
if(FALSE) {
	y <- FALSE
} else {
	y <- TRUE
}
print(y)`, emptyGraph()
				.defineVariable('5@y', 'y', { definedBy: ['5@y', '5@TRUE'] })
				.constant('5@TRUE'), { expectIsSubgraph: true, resolveIdsAsCriterion: true });

		assertDataflow(label('useless branch (complete graph)', ['if', 'control-flow', 'built-in']),
			shell, `x <- 1
if(TRUE) {
	x <- 3 
} else {
	x <- 2
}
x`, emptyGraph()
				.defineVariable('1@x', 'x', { definedBy: ['1@1', '1@<-'] })
				.call('1@<-', '<-', [argumentInCall('1@x'), argumentInCall('1@1')], { returns: ['1@x'], onlyBuiltIn: true, reads: [NodeId.toBuiltIn('<-'), '1@1'] })
				.calls('1@<-', NodeId.toBuiltIn('<-'))
				.constant('1@1')
				.constant('2@TRUE')
				.call('2@if', 'if', [argumentInCall('2@TRUE'), argumentInCall('$9')], { reads: ['2@TRUE', NodeId.toBuiltIn('if')], returns: ['$9'], onlyBuiltIn: true })
				.calls('2@if', NodeId.toBuiltIn('if'))
				.call('$9', '{', [argumentInCall('3@<-')], { reads: [NodeId.toBuiltIn('{')], returns: ['3@<-'], onlyBuiltIn: true })
				.calls('$9', NodeId.toBuiltIn('{'))
				.defineVariable('3@x', 'x', { definedBy: ['3@3', '3@<-'] })
				.call('3@<-', '<-', [argumentInCall('3@x'), argumentInCall('3@3')], { reads: [NodeId.toBuiltIn('<-'), '3@3'], returns: ['3@x'], onlyBuiltIn: true })
				.calls('3@<-', NodeId.toBuiltIn('<-'))
				.constant('3@3')
				.reads('7@x', '3@x')
				.use('7@x')
			, { resolveIdsAsCriterion: true });
	});
	describe('ifelse function', () => {
		assertDataflow(label('Traditional ifelse use', ['name-normal', 'if', 'unnamed-arguments']), shell,
			'ifelse(u, a, b)', emptyGraph()
				.reads('1@ifelse', '1@u')
				.call('1@ifelse', 'ifelse', [argumentInCall('1@u'), argumentInCall('1@a'), argumentInCall('1@b')], { returns: ['1@a', '1@b'], reads: [NodeId.toBuiltIn('ifelse')], onlyBuiltIn: true })
				.calls('1@ifelse', NodeId.toBuiltIn('ifelse'))
			,
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
		);
		assertDataflow(label('ifelse with reordering', ['name-normal', 'if', 'named-arguments']), shell,
			'ifelse(yes=a,test=u,no=b)', emptyGraph()
				.reads('1@ifelse', '1@u')
				.call('1@ifelse', 'ifelse', [argumentInCall('1@u'), argumentInCall('1@a'), argumentInCall('1@b')], { returns: ['1@a', '1@b'], reads: [NodeId.toBuiltIn('ifelse')], onlyBuiltIn: true })
				.calls('1@ifelse', NodeId.toBuiltIn('ifelse'))
			,
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
		);
	});
}));
