import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder';
import { assertDataflow, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { builtInId } from '../../../../../src/dataflow/environments/built-in';
import { EmptyArgument } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { ReferenceType } from '../../../../../src/dataflow/environments/identifier';
import { setSourceProvider } from '../../../../../src/dataflow/internal/process/functions/call/built-in/built-in-source';
import { requestProviderFromFile, requestProviderFromText } from '../../../../../src/r-bridge/retriever';
import { afterAll, beforeAll, describe } from 'vitest';
import type { FlowrLaxSourcingOptions } from '../../../../../src/config';
import { amendConfig, defaultConfigOptions } from '../../../../../src/config';
import { deepMergeObject } from '../../../../../src/util/objects';

describe.sequential('source', withShell(shell => {
	const sources = {
		simple:     'N <- 9',
		recursive1: 'x <- 1\nsource("recursive2")',
		recursive2: 'cat(x)\nsource("recursive1")',
		closure1:   'f <- function() { function() 3 }',
		closure2:   'f <- function() { x <<- 3 }'
	};

	beforeAll(() => {
		setSourceProvider(requestProviderFromText(sources));
	});
	afterAll(() => {
		setSourceProvider(requestProviderFromFile());
	});

	const config = amendConfig(defaultConfigOptions, c => {
		c.solver.resolveSource = deepMergeObject(
			defaultConfigOptions.solver.resolveSource,
			{ repeatedSourceLimit: 0 }
		) as FlowrLaxSourcingOptions;
		return c;
	});

	assertDataflow(label('simple source', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files','newlines']), shell, 'source("simple")\ncat(N)', emptyGraph()
		.use('5', 'N')
		.reads('5', 'simple-1:1-1:6-0')
		.call('3', 'source', [argumentInCall('1')], { returns: [], reads: [builtInId('source')] })
		.calls('3', builtInId('source'))
		.call('simple-1:1-1:6-2', '<-', [argumentInCall('simple-1:1-1:6-0'), argumentInCall('simple-1:1-1:6-1')], { returns: ['simple-1:1-1:6-0'], reads: [builtInId('<-')] })
		.calls('simple-1:1-1:6-2', builtInId('<-'))
		.addControlDependency('simple-1:1-1:6-2', '3', true)
		.call('7', 'cat', [argumentInCall('5')], { returns: [], reads: [builtInId('cat')], environment: defaultEnv().defineVariable('N', 'simple-1:1-1:6-0', 'simple-1:1-1:6-2') })
		.calls('7', builtInId('cat'))
		.reads('7', '5')
		.constant('1')
		.constant('simple-1:1-1:6-1')
		.defineVariable('simple-1:1-1:6-0', 'N', { definedBy: ['simple-1:1-1:6-1', 'simple-1:1-1:6-2'] })
		.addControlDependency('simple-1:1-1:6-0', '3', true)
		.markIdForUnknownSideEffects('7'),
	undefined, undefined, config
	);

	assertDataflow(label('multiple source', ['sourcing-external-files', 'strings', 'unnamed-arguments', 'normal-definition', 'newlines']), shell, 'source("simple")\nN <- 0\nsource("simple")\ncat(N)',  emptyGraph()
		.use('12', 'N')
		.reads('12', 'simple-3:1-3:6-0')
		.call('3', 'source', [argumentInCall('1')], { returns: [], reads: [builtInId('source')] })
		.calls('3', builtInId('source'))
		.call('simple-1:1-1:6-2', '<-', [argumentInCall('simple-1:1-1:6-0'), argumentInCall('simple-1:1-1:6-1')], { returns: ['simple-1:1-1:6-0'], reads: [builtInId('<-')] })
		.calls('simple-1:1-1:6-2', builtInId('<-'))
		.addControlDependency('simple-1:1-1:6-2', '3', true)
		.call('6', '<-', [argumentInCall('4'), argumentInCall('5')], { returns: ['4'], reads: [builtInId('<-')], environment: defaultEnv().defineVariable('N', 'simple-1:1-1:6-0', 'simple-1:1-1:6-2') })
		.calls('6', builtInId('<-'))
		.call('10', 'source', [argumentInCall('8')], { returns: [], reads: [builtInId('source')], environment: defaultEnv().defineVariable('N', '4', '6') })
		.calls('10', builtInId('source'))
		.call('simple-3:1-3:6-2', '<-', [argumentInCall('simple-3:1-3:6-0'), argumentInCall('simple-3:1-3:6-1')], { returns: ['simple-3:1-3:6-0'], reads: [builtInId('<-')], environment: defaultEnv().defineVariable('N', '4', '6') })
		.calls('simple-3:1-3:6-2', builtInId('<-'))
		.addControlDependency('simple-3:1-3:6-2', '10', true)
		.call('14', 'cat', [argumentInCall('12')], { returns: [], reads: [builtInId('cat')], environment: defaultEnv().defineVariable('N', 'simple-3:1-3:6-0', 'simple-3:1-3:6-2') })
		.calls('14', builtInId('cat'))
		.reads('14', '12')
		.constant('1')
		.constant('simple-1:1-1:6-1')
		.defineVariable('simple-1:1-1:6-0', 'N', { definedBy: ['simple-1:1-1:6-1', 'simple-1:1-1:6-2'] })
		.addControlDependency('simple-1:1-1:6-0', '3', true)
		.constant('5')
		.defineVariable('4', 'N', { definedBy: ['5', '6'] })
		.constant('8')
		.constant('simple-3:1-3:6-1')
		.defineVariable('simple-3:1-3:6-0', 'N', { definedBy: ['simple-3:1-3:6-1', 'simple-3:1-3:6-2'] })
		.addControlDependency('simple-3:1-3:6-0', '10', true)
		.markIdForUnknownSideEffects('14'),
	undefined, undefined, config
	);

	assertDataflow(label('conditional', ['if', 'name-normal', 'sourcing-external-files', 'unnamed-arguments', 'strings']), shell, 'if (x) { source("simple") }\ncat(N)',  emptyGraph()
		.use('0', 'x')
		.use('10', 'N')
		.reads('10', 'simple-1:10-1:15-0')
		.call('6', 'source', [argumentInCall('4')], { returns: [], reads: [builtInId('source')], controlDependencies: [{ id: '8', when: true }] })
		.calls('6', builtInId('source'))
		.call('simple-1:10-1:15-2', '<-', [argumentInCall('simple-1:10-1:15-0'), argumentInCall('simple-1:10-1:15-1')], { returns: ['simple-1:10-1:15-0'], reads: [builtInId('<-')] })
		.calls('simple-1:10-1:15-2', builtInId('<-'))
		.addControlDependency('simple-1:10-1:15-2', '6', true)
		.addControlDependency('simple-1:10-1:15-2', '8', true)
		.call('7', '{', [argumentInCall('6')], { returns: ['6'], reads: [builtInId('{')], controlDependencies: [{ id: '8', when: true }] })
		.calls('7', builtInId('{'))
		.call('8', 'if', [argumentInCall('0'), argumentInCall('7'), EmptyArgument], { returns: ['7'], reads: ['0', builtInId('if')], onlyBuiltIn: true })
		.calls('8', builtInId('if'))
		.call('12', 'cat', [argumentInCall('10')], { returns: [], reads: [builtInId('cat')], environment: defaultEnv().defineVariable('N', 'simple-1:10-1:15-0', 'simple-1:10-1:15-2') })
		.calls('12', builtInId('cat'))
		.reads('12', '10')
		.constant('4')
		.constant('simple-1:10-1:15-1')
		.defineVariable('simple-1:10-1:15-0', 'N', { definedBy: ['simple-1:10-1:15-1', 'simple-1:10-1:15-2'] })
		.addControlDependency('simple-1:10-1:15-0', '6', true)
		.addControlDependency('simple-1:10-1:15-0', '8', true)
		.markIdForUnknownSideEffects('12'),

	undefined, undefined, config
	);

	// missing sources should just be ignored
	assertDataflow(label('missing source', ['unnamed-arguments', 'strings', 'sourcing-external-files']), shell, 'source("missing")', emptyGraph()
		.call('3', 'source', [argumentInCall('1')], { returns: [], reads: [builtInId('source')] })
		.calls('3', builtInId('source'))
		.constant('1')
		.markIdForUnknownSideEffects('3'),
	undefined, undefined, config
	);

	assertDataflow(label('recursive source', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files', 'newlines']), shell, sources.recursive1,  emptyGraph()
		.use('recursive2-2:1-2:6-1', 'x')
		.reads('recursive2-2:1-2:6-1', '0')
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [builtInId('<-')] })
		.calls('2', builtInId('<-'))
		.call('6', 'source', [argumentInCall('4')], { returns: [], reads: [builtInId('source')], environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('6', builtInId('source'))
		.call('recursive2-2:1-2:6-3', 'cat', [argumentInCall('recursive2-2:1-2:6-1')], { returns: [], reads: [builtInId('cat')], environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('recursive2-2:1-2:6-3', builtInId('cat'))
		.reads('recursive2-2:1-2:6-3', 'recursive2-2:1-2:6-1')
		.addControlDependency('recursive2-2:1-2:6-3', '6', true)
		.call('recursive2-2:1-2:6-7', 'source', [argumentInCall('recursive2-2:1-2:6-5')], { returns: [], reads: [builtInId('source')], environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('recursive2-2:1-2:6-7', builtInId('source'))
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		.constant('4')
		.constant('recursive2-2:1-2:6-5')
		/* indicate recursion */
		.markIdForUnknownSideEffects('recursive2-2:1-2:6-7')
		.markIdForUnknownSideEffects('recursive2-2:1-2:6-3'),
	undefined, undefined, config
	);

	describe('Increase source limit', () => {
		assertDataflow(label('recursive source (higher limit)', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files', 'newlines']), shell, sources.recursive1,  emptyGraph()
			.use('recursive2-2:1-2:6-1', 'x')
			.use('1::recursive2-2:1-2:6-1', 'x')
			.use('2::recursive2-2:1-2:6-1', 'x'), {
			expectIsSubgraph: true
		},
		undefined, amendConfig(defaultConfigOptions, c => {
			c.solver.resolveSource = deepMergeObject(
				c.solver.resolveSource,
				{ repeatedSourceLimit: 2 }
			) as FlowrLaxSourcingOptions;
			return c;
		})
		);
	});

	assertDataflow(label('non-constant source (but constant alias)', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'strings', 'newlines', 'unnamed-arguments']), shell, 'x <- "simple"\nsource(x)',  emptyGraph()
		.use('4', 'x')
		.reads('4', '0')
		.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [builtInId('<-')] })
		.calls('2', builtInId('<-'))
		.call('6', 'source', [argumentInCall('4')], { returns: [], reads: [builtInId('source')], environment: defaultEnv().defineVariable('x', '0', '2') })
		.calls('6', builtInId('source'))
		.defineVariable('simple-2:1-2:6-0', 'N', { definedBy: ['simple-2:1-2:6-1', 'simple-2:1-2:6-2'] })
		.call('simple-2:1-2:6-2', '<-', [argumentInCall('simple-2:1-2:6-0'), argumentInCall('simple-2:1-2:6-1')], { returns: ['simple-2:1-2:6-0'], reads: [builtInId('<-')] })
		.calls('simple-2:1-2:6-2', builtInId('<-'))
		.addControlDependency('simple-2:1-2:6-2', '6', true)
		.addControlDependency('simple-2:1-2:6-0', '6', true)
		.constant('simple-2:1-2:6-1')
		.constant('1')
		.defineVariable('0', 'x', { definedBy: ['1', '2'] }),
	undefined, undefined, config
	);

	assertDataflow(label('sourcing a closure', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'sourcing-external-files', 'newlines', 'normal-definition', 'implicit-return', 'closures', 'numbers']),
		shell, 'source("closure1")\ng <- f()\nprint(g())', emptyGraph()
			.call('3', 'source', [argumentInCall('1')], { returns: [], reads: [builtInId('source')] })
			.calls('3', builtInId('source'))
			.argument('3', '1')
			.call('closure1-1:1-1:6-8', '<-', [argumentInCall('closure1-1:1-1:6-0'), argumentInCall('closure1-1:1-1:6-7')], { returns: ['closure1-1:1-1:6-0'], reads: [builtInId('<-')] })
			.calls('closure1-1:1-1:6-8', builtInId('<-'))
			.addControlDependency('closure1-1:1-1:6-8', '3', true)
			.argument('closure1-1:1-1:6-8', ['closure1-1:1-1:6-7', 'closure1-1:1-1:6-0'])
			.call('6', 'f', [], { returns: ['closure1-1:1-1:6-5'], reads: ['closure1-1:1-1:6-0'], environment: defaultEnv().defineFunction('f', 'closure1-1:1-1:6-0', 'closure1-1:1-1:6-8') })
			.calls('6', 'closure1-1:1-1:6-7')
			.argument('7', '6')
			.call('7', '<-', [argumentInCall('4'), argumentInCall('6')], { returns: ['4'], reads: [builtInId('<-')], environment: defaultEnv().defineFunction('f', 'closure1-1:1-1:6-0', 'closure1-1:1-1:6-8') })
			.calls('7', builtInId('<-'))
			.argument('7', '4')
			.call('10', 'g', [], { returns: ['closure1-1:1-1:6-3'], reads: ['4'], environment: defaultEnv().defineFunction('f', 'closure1-1:1-1:6-0', 'closure1-1:1-1:6-8').defineVariable('g', '4', '7') })
			.calls('10', 'closure1-1:1-1:6-5')
			.argument('12', '10')
			.reads('12', '10')
			.call('12', 'print', [argumentInCall('10')], { returns: ['10'], reads: [builtInId('print')], environment: defaultEnv().defineFunction('f', 'closure1-1:1-1:6-0', 'closure1-1:1-1:6-8').defineVariable('g', '4', '7') })
			.calls('12', builtInId('print'))
			.constant('1')
			.constant('closure1-1:1-1:6-3', undefined, false)
			.defineFunction('closure1-1:1-1:6-5', ['closure1-1:1-1:6-3'], {
				out:               [],
				in:                [{ nodeId: 'closure1-1:1-1:6-3', name: undefined, controlDependencies: [], type: ReferenceType.Argument }],
				unknownReferences: [],
				entryPoint:        'closure1-1:1-1:6-3',
				graph:             new Set(['closure1-1:1-1:6-3']),
				environment:       defaultEnv().pushEnv().pushEnv(),
			}, { environment: defaultEnv().pushEnv() }, false)
			.defineFunction('closure1-1:1-1:6-7', ['closure1-1:1-1:6-5'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        'closure1-1:1-1:6-5',
				graph:             new Set(['closure1-1:1-1:6-5']),
				environment:       defaultEnv().pushEnv(),
			})
			.defineVariable('closure1-1:1-1:6-0', 'f', { definedBy: ['closure1-1:1-1:6-7', 'closure1-1:1-1:6-8'] })
			.addControlDependency('closure1-1:1-1:6-0', '3', true)
			.defineVariable('4', 'g', { definedBy: ['6', '7'] })
			.markIdForUnknownSideEffects('12'),
		undefined, undefined, config
	);
	assertDataflow(label('sourcing a closure w/ side effects', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'sourcing-external-files', 'newlines', 'normal-definition', 'implicit-return', 'closures', 'numbers', ...OperatorDatabase['<<-'].capabilities]),
		shell, 'x <- 2\nsource("closure2")\nf()\nprint(x)', emptyGraph()
			.use('10', 'x')
			.reads('10', 'closure2-2:1-2:6-3')
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [builtInId('<-')] })
			.calls('2', builtInId('<-'))
			.argument('2', ['1', '0'])
			.call('6', 'source', [argumentInCall('4')], { returns: [], reads: [builtInId('source')], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('6', builtInId('source'))
			.argument('6', '4')
			.call('closure2-2:1-2:6-5', '<<-', [argumentInCall('closure2-2:1-2:6-3'), argumentInCall('closure2-2:1-2:6-4')], { returns: ['closure2-2:1-2:6-3'], reads: [builtInId('<<-')], environment: defaultEnv().pushEnv() }, false)
			.calls('closure2-2:1-2:6-5', builtInId('<<-'))
			.argument('closure2-2:1-2:6-5', ['closure2-2:1-2:6-4', 'closure2-2:1-2:6-3'])
			.call('closure2-2:1-2:6-8', '<-', [argumentInCall('closure2-2:1-2:6-0'), argumentInCall('closure2-2:1-2:6-7')], { returns: ['closure2-2:1-2:6-0'], reads: [builtInId('<-')], environment: defaultEnv().defineVariable('x', '0', '2') })
			.calls('closure2-2:1-2:6-8', builtInId('<-'))
			.addControlDependency('closure2-2:1-2:6-8', '6', true)
			.argument('closure2-2:1-2:6-8', ['closure2-2:1-2:6-7', 'closure2-2:1-2:6-0'])
			.call('8', 'f', [], { returns: ['closure2-2:1-2:6-5'], reads: ['closure2-2:1-2:6-0'], environment: defaultEnv().defineVariable('x', '0', '2').defineFunction('f', 'closure2-2:1-2:6-0', 'closure2-2:1-2:6-8') })
			.calls('8', 'closure2-2:1-2:6-7')
			.argument('12', '10')
			.reads('12', '10')
			.call('12', 'print', [argumentInCall('10')], { returns: ['10'], reads: [builtInId('print')], environment: defaultEnv().defineVariable('x', 'closure2-2:1-2:6-3', 'closure2-2:1-2:6-5').defineFunction('f', 'closure2-2:1-2:6-0', 'closure2-2:1-2:6-8') })
			.calls('12', builtInId('print'))
			.constant('1')
			.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			.constant('4')
			.constant('closure2-2:1-2:6-4', undefined, false)
			.defineVariable('closure2-2:1-2:6-3', 'x', { definedBy: ['closure2-2:1-2:6-4', 'closure2-2:1-2:6-5'] }, false)
			.sideEffectOnCall('closure2-2:1-2:6-3', '8')
			.defineFunction('closure2-2:1-2:6-7', ['closure2-2:1-2:6-5'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        'closure2-2:1-2:6-5',
				graph:             new Set(['closure2-2:1-2:6-4', 'closure2-2:1-2:6-3', 'closure2-2:1-2:6-5']),
				environment:       defaultEnv().defineVariable('x', 'closure2-2:1-2:6-3', 'closure2-2:1-2:6-5').pushEnv(),
			}, {
				environment: defaultEnv().defineVariable('x', 'closure2-2:1-2:6-3', 'closure2-2:1-2:6-5'),
			})
			.defineVariable('closure2-2:1-2:6-0', 'f', { definedBy: ['closure2-2:1-2:6-7', 'closure2-2:1-2:6-8'] })
			.addControlDependency('closure2-2:1-2:6-0', '6', true)
			.markIdForUnknownSideEffects('12'),
		undefined, undefined, config
	);
}));
