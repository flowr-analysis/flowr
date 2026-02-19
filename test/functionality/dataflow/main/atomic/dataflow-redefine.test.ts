import { assertDataflow, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder';
import { EmptyArgument } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { BuiltInProcName } from '../../../../../src/dataflow/environments/built-in';
import { ReferenceType } from '../../../../../src/dataflow/environments/identifier';
import { describe } from 'vitest';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe.sequential('Redefining builtins', withShell(shell => {
	assertDataflow(label('if (print)', ['name-escaped', 'formals-dot-dot-dot', 'implicit-return', 'numbers', 'unnamed-arguments', ...OperatorDatabase['<-'].capabilities, 'newlines']),
		shell, `\`if\` <- function(...) 2
if(1) 
   print(3)`,  emptyGraph()
			.call('6', '<-', [argumentInCall('0'), argumentInCall('5')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 5], onlyBuiltIn: true })
			.calls('6', NodeId.toBuiltIn('<-'))
			.argument('6', ['5', '0'])
			.call('11', 'print', [argumentInCall('9')], { returns: ['9'], reads: [NodeId.toBuiltIn('print')] })
			.calls('11', NodeId.toBuiltIn('print'))
			.argument('11', '9')
			.definesOnCall('11', '1')
			.definedByOnCall('1', '11')
			.argument('13', '11')
			.call('13', 'if', [argumentInCall('7'), argumentInCall('11'), EmptyArgument], { origin: [BuiltInProcName.Function], returns: ['3'], reads: ['0'], environment: defaultEnv().defineFunction('if', '0', '6') })
			.calls('13', '5')
			.defineVariable('1', '...', { definedBy: [] }, false)
			.constant('3', undefined, false)
			.defineFunction('5', ['3'], {
				out:               [],
				in:                [{ nodeId: '3', name: undefined, cds: [], type: ReferenceType.Argument }],
				unknownReferences: [],
				entryPoint:        '3',
				graph:             new Set(['1', '3']),
				environment:       defaultEnv().pushEnv().defineParameter('...', '1', '2')
			}, { readParams: [[1, false]] })
			.defineVariable('0', '`if`', { definedBy: ['5', '6'] })
			.constant('7')
			.definesOnCall('7', '1')
			.definedByOnCall('1', '7')
			.constant('9').markIdForUnknownSideEffects('11'));
	assertDataflow(label('if (assignment)', ['name-escaped', 'formals-dot-dot-dot', 'implicit-return', 'numbers', 'unnamed-arguments', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'newlines']),
		shell, `\`if\` <- function(...) 2
if(1) 
   x <- 3
print(x)`, emptyGraph()
			.use('14', 'x')
			.reads('14', '8')
			.call('6', '<-', [argumentInCall('0'), argumentInCall('5')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 5], onlyBuiltIn: true })
			.calls('6', NodeId.toBuiltIn('<-'))
			.argument('6', ['5', '0'])
			.call('10', '<-', [argumentInCall('8'), argumentInCall('9')], { returns: ['8'], reads: [NodeId.toBuiltIn('<-'), 9], onlyBuiltIn: true, environment: defaultEnv().defineFunction('if', '0', '6') })
			.calls('10', NodeId.toBuiltIn('<-'))
			.argument('10', ['9', '8'])
			.definesOnCall('10', '1')
			.definedByOnCall('1', '10')
			.argument('12', '10')
			.call('12', 'if', [argumentInCall('7'), argumentInCall('10'), EmptyArgument], { origin: [BuiltInProcName.Function], returns: ['3'], reads: ['0'], environment: defaultEnv().defineFunction('if', '0', '6') })
			.argument('12', '7')
			.calls('12', '5')
			.argument('16', '14')
			.reads('16', '14')
			.call('16', 'print', [argumentInCall('14')], { returns: ['14'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineFunction('if', '0', '6').defineVariable('x', '8', '10') })
			.calls('16', NodeId.toBuiltIn('print'))
			.defineVariable('1', '...', { definedBy: [] }, false)
			.constant('3', undefined, false)
			.defineFunction('5', ['3'], {
				out:               [],
				in:                [{ nodeId: '3', name: undefined, cds: [], type: ReferenceType.Argument }],
				unknownReferences: [],
				entryPoint:        '3',
				graph:             new Set(['1', '3']),
				environment:       defaultEnv().pushEnv().defineParameter('...', '1', '2')
			}, { readParams: [[1, false]] })
			.defineVariable('0', '`if`', { definedBy: ['5', '6'] })
			.constant('7')
			.definesOnCall('7', '1')
			.definedByOnCall('1', '7')
			.constant('9')
			.defineVariable('8', 'x', { definedBy: ['9', '10'] })
			.markIdForUnknownSideEffects('16'));
	assertDataflow(label('<-', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'name-escaped', ...OperatorDatabase['*'].capabilities, 'named-arguments']),
		shell, `x <- 2
\`<-\` <- \`*\`
x <- 3
print(y = x)`, emptyGraph()
			.use('4', '`*`')
			.reads('4', NodeId.toBuiltIn('*'))
			.use('6', 'x')
			.reads('6', '0')
			.use('11', 'x')
			.reads('11', '0')
			.use('12', 'y')
			.reads('12', '11')
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
			.calls('2', NodeId.toBuiltIn('<-'))
			.argument('2', ['1', '0'])
			.argument('5', '4')
			.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [NodeId.toBuiltIn('<-'), 4], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('5', NodeId.toBuiltIn('<-'))
			.argument('5', '3')
			.argument('8', '6')
			.call('8', '<-', [argumentInCall('6'), argumentInCall('7')], { origin: [BuiltInProcName.Function], returns: [], reads: ['3'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('<-', '3', '5') })
			.calls(8, NodeId.toBuiltIn('*'))
			.argument('8', '7')
			.argument('13', '12')
			.reads('13', '11')
			.call('13', 'print', [argumentInCall('12', { name: 'y' } )], { returns: ['12'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('<-', '3', '5') })
			.calls('13', NodeId.toBuiltIn('print'))
			.constant('1')
			.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			.defineVariable('3', '`<-`', { definedBy: ['4', '5'] })
			.constant('7')
			.markIdForUnknownSideEffects('13'));
	assertDataflow(label('<- in function', ['name-normal', 'name-escaped', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'newlines', ...OperatorDatabase['*'].capabilities, 'call-normal', 'unnamed-arguments']),
		shell, `f <- function() {
   x <- 2
   \`<-\` <- \`*\`
   x <- 3
}
y <- f()
print(y)`, emptyGraph()
			.use('7', '`*`', undefined, false)
			.reads('7', NodeId.toBuiltIn('*'))
			.use('9', 'x', undefined, false)
			.reads('9', '3')
			.use('20', 'y')
			.reads('20', '15')
			.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [NodeId.toBuiltIn('<-'), 4], onlyBuiltIn: true, environment: defaultEnv().pushEnv() }, false)
			.calls('5', NodeId.toBuiltIn('<-'))
			.argument('5', ['4', '3'])
			.argument('8', '7')
			.call('8', '<-', [argumentInCall('6'), argumentInCall('7')], { returns: ['6'], reads: [NodeId.toBuiltIn('<-'), 7], onlyBuiltIn: true, environment: defaultEnv().pushEnv().defineVariable('x', '3', '5') }, false)
			.calls('8', NodeId.toBuiltIn('<-'))
			.argument('8', '6')
			.argument('11', '9')
			.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { origin: [BuiltInProcName.Function], returns: [], reads: ['6'], environment: defaultEnv().pushEnv().defineVariable('x', '3', '5').defineVariable('<-', '6', '8') }, false)
			.calls('11', NodeId.toBuiltIn('*'))
			.argument('11', '10')
			.argument('12', '5')
			.argument('12', '8')
			.argument('12', '11')
			.call('12', '{', [argumentInCall('5'), argumentInCall('8'), argumentInCall('11')], { returns: ['11'], reads: [NodeId.toBuiltIn('{')], environment: defaultEnv().pushEnv().defineVariable('x', '3', '5').defineVariable('<-', '6', '8') }, false)
			.calls('12', NodeId.toBuiltIn('{'))
			.call('14', '<-', [argumentInCall('0'), argumentInCall('13')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 13], onlyBuiltIn: true })
			.calls('14', NodeId.toBuiltIn('<-'))
			.argument('14', ['13', '0'])
			.call('17', 'f', [], { returns: ['11'], reads: ['0'], environment: defaultEnv().defineFunction('f', '0', '14') })
			.calls('17', '13')
			.argument('18', '17')
			.call('18', '<-', [argumentInCall('15'), argumentInCall('17')], { returns: ['15'], reads: [NodeId.toBuiltIn('<-'), 17], onlyBuiltIn: true, environment: defaultEnv().defineFunction('f', '0', '14') })
			.calls('18', NodeId.toBuiltIn('<-'))
			.argument('18', '15')
			.argument('22', '20')
			.reads('22', '20')
			.call('22', 'print', [argumentInCall('20')], { returns: ['20'], reads: [NodeId.toBuiltIn('print')], environment: defaultEnv().defineFunction('f', '0', '14').defineVariable('y', '15', '18') })
			.calls('22', NodeId.toBuiltIn('print'))
			.constant('4', undefined, false)
			.defineVariable('3', 'x', { definedBy: ['4', '5'] }, false)
			.defineVariable('6', '`<-`', { definedBy: ['7', '8'] }, false)
			.constant('10', undefined, false)
			.defineFunction('13', ['11'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '12',
				graph:             new Set(['4', '3', '5', '7', '6', '8', '9', '10', '11', '12']),
				environment:       defaultEnv().pushEnv().defineVariable('x', '3', '5').defineVariable('<-', '6', '8')
			})
			.defineVariable('0', 'f', { definedBy: ['13', '14'] })
			.defineVariable('15', 'y', { definedBy: ['17', '18'] })
			.markIdForUnknownSideEffects('22'));
}));
