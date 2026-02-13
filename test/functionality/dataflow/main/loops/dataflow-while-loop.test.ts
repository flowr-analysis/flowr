import { assertDataflow, withShell } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { builtInId, BuiltInProcName } from '../../../../../src/dataflow/environments/built-in';
import { describe } from 'vitest';

describe.sequential('While', withShell(shell => {
	assertDataflow(label('simple constant while', ['while-loop', 'logical', 'numbers']), shell, 'while (TRUE) 2', emptyGraph()
		.call('3', 'while', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: ['0', builtInId('while')], onlyBuiltIn: true, origin: [BuiltInProcName.WhileLoop] })
		.calls('3', builtInId('while'))
		.nse('3', '1')
		.constant('0')
		.constant('1')
	);
	assertDataflow(label('using variable in body', ['while-loop', 'logical', 'name-normal']), shell, 'while (TRUE) x', emptyGraph()
		.use('1', 'x', { cds: [{ id: 3, when: true }] })
		.call('3', 'while', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: ['0', builtInId('while')], onlyBuiltIn: true, origin: [BuiltInProcName.WhileLoop] })
		.calls('3', builtInId('while'))
		.nse('3', '1')
		.constant('0')
	);
	assertDataflow(label('assignment in loop body', ['while-loop', 'logical', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers']), shell, 'while (TRUE) { x <- 3 }', emptyGraph()
		.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [builtInId('<-'), 4], onlyBuiltIn: true, cds: [{ id: 7, when: true }], origin: [BuiltInProcName.Assignment] })
		.calls('5', builtInId('<-'))
		.call('6', '{', [argumentInCall('5')], { returns: ['5'], reads: [builtInId('{')], cds: [{ id: 7, when: true }], origin: [BuiltInProcName.ExpressionList] })
		.calls('6', builtInId('{'))
		.call('7', 'while', [argumentInCall('0'), argumentInCall('6')], { returns: [], reads: ['0', builtInId('while')], onlyBuiltIn: true, origin: [BuiltInProcName.WhileLoop] })
		.calls('7', builtInId('while'))
		.nse('7', '6')
		.constant('0')
		.constant('4')
		.defineVariable('3', 'x', { definedBy: ['4', '5'], cds: [{ id: 7, when: true }] })
	);
	assertDataflow(label('def compare in loop', ['while-loop', 'grouping', ...OperatorDatabase['<-'].capabilities, 'name-normal', 'infix-calls', 'binary-operator', ...OperatorDatabase['-'].capabilities, ...OperatorDatabase['>'].capabilities, 'precedence']), shell, 'while ((x <- x - 1) > 0) { x }', emptyGraph()
		.use('3', 'x')
		.use('12', 'x', { cds: [{ id: 14, when: true }] })
		.reads('12', '2')
		.call('5', '-', [argumentInCall('3'), argumentInCall('4')], { returns: [], reads: [builtInId('-'), '3', '4'], onlyBuiltIn: true, origin: [BuiltInProcName.Default] })
		.calls('5', builtInId('-'))
		.call('6', '<-', [argumentInCall('2'), argumentInCall('5')], { returns: ['2'], reads: [builtInId('<-'), 5], origin: [BuiltInProcName.Assignment], onlyBuiltIn: true })
		.calls('6', builtInId('<-'))
		.call('7', '(', [argumentInCall('6')], { returns: ['6'], reads: [builtInId('(')], origin: [BuiltInProcName.Default] })
		.calls('7', builtInId('('))
		.call('9', '>', [argumentInCall('7'), argumentInCall('8')], { returns: [], reads: [builtInId('>'), '7', '8'], onlyBuiltIn: true, origin: [BuiltInProcName.Default] })
		.calls('9', builtInId('>'))
		.call('13', '{', [argumentInCall('12')], { returns: ['12'], reads: [builtInId('{')], cds: [{ id: 14, when: true }], environment: defaultEnv().defineVariable('x', '2', '6'), origin: [BuiltInProcName.ExpressionList] })
		.calls('13', builtInId('{'))
		.call('14', 'while', [argumentInCall('9'), argumentInCall('13')], { returns: [], reads: ['9', builtInId('while')], onlyBuiltIn: true, origin: [BuiltInProcName.WhileLoop] })
		.calls('14', builtInId('while'))
		.nse('14', '13')
		.constant('4')
		.defineVariable('2', 'x', { definedBy: ['5', '6'] })
		.constant('8')
	);
	assertDataflow(label('Endless while loop with variables', ['while-loop', 'name-normal']), shell, 'while(x) y', emptyGraph()
		.use('0', 'x')
		.use('1', 'y', { cds: [{ id: 3, when: true }] })
		.argument('3', '0')
		.argument('3', '1')
		.call('3', 'while', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: ['0', builtInId('while')], onlyBuiltIn: true, origin: [BuiltInProcName.WhileLoop] })
		.calls('3', builtInId('while'))
		.nse('3', '1')
	);
	assertDataflow(label('Loop Definitions', ['while-loop', 'name-normal', 'local-left-assignment']), shell, `x <- 1
while (x < 10) {
    x <- x + 1
    x <- x - 1
}
print(x)`, emptyGraph()
		.reads('4:10', '3@x')
		.reads('3:10', '1@x')
		.reads('3:10', '4@x')
	, {
		expectIsSubgraph:      true,
		resolveIdsAsCriterion: true,
		mustNotHaveEdges:      [['4:10', '1@x'], ['4:10', '4@x']]
	});
}));
