import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { builtInId } from '../../../../src/dataflow/environments/built-in';
import { argumentInCall, defaultEnv } from '../../_helper/dataflow/environment-builder';

describe('Call Graph Generation', withTreeSitter(ts => {
	assertDataflow(label('sample calls', ['function-calls', 'function-definitions', 'resolution', 'resolve-arguments', 'built-in']),
		ts,
		`foo <- function(x) {
			return(x + 1)
		}
		bar <- function(y) {
			return(foo(y) * 2)
		}
		u <- bar(3)
		`,
		emptyGraph()
			.call('1@<-', '<-', [argumentInCall('1@foo'), argumentInCall('1@function')], { onlyBuiltIn: true, omitArgs: true })
			.calls('1@<-', builtInId('function')).calls('1@<-', builtInId('assignment'))
			.call('4@<-', '<-', [argumentInCall('4@bar'), argumentInCall('4@function')], { onlyBuiltIn: true, omitArgs: true })
			.calls('4@<-', builtInId('function')).calls('4@<-', builtInId('assignment'))
			.call('7@<-', '<-', [argumentInCall('7@u'), argumentInCall('7@bar')], { onlyBuiltIn: true, omitArgs: true })
			.calls('7@<-', builtInId('assignment')).calls('7@<-', '7@bar')
			.call('7@bar', 'bar', [argumentInCall('7@3')], { omitArgs: true })
			.calls('7@bar', '4@function')
			.calls('7@bar', '5@return')
			.defineFunction('4@function', [27], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '5@return',
				graph:             new Set([15, 21, 23, 24, 25, 27, 28]),
				environment:       defaultEnv().pushEnv().defineParameter('y', '4@y', '4@y')
			}, { readParams: [[15, true]] })
			.calls('4@function', '5@return')
			.defineFunction('1@function', [10], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '2@return',
				graph:             new Set([1, 6, 7, 8, 10, 11]),
				environment:       defaultEnv().pushEnv().defineParameter('x', '1@x', '1@x')
			}, { readParams: [[1, true]] })
			.call('2@return', 'return', [argumentInCall('2@return')], { onlyBuiltIn: true, omitArgs: true, origin: ['builtin:return'] })
			.calls('2@return', builtInId('return')).calls('2@return', '2@+')
			.call('2@+', '+', [argumentInCall('2@x'), argumentInCall('2@1')], { onlyBuiltIn: true, omitArgs: true })
			.calls('2@+', builtInId('default'))
			.call('5@return', 'return', [argumentInCall('5@return')], { onlyBuiltIn: true, omitArgs: true, origin: ['builtin:return'] })
			.calls('1@function', '2@return')
			.calls('5@return', builtInId('return')).calls('5@return', '5@*')
			.call('5@*', '*', [argumentInCall('5@foo'), argumentInCall('5@2')], { onlyBuiltIn: true, omitArgs: true })
			.calls('5@*', builtInId('default')).calls('5@*', '5@foo')
			.call('5@foo', 'foo', [argumentInCall('5@y')], { omitArgs: true })
			.calls('5@foo', '1@function')
		, { context: 'call-graph', resolveIdsAsCriterion: true }
	);

	assertDataflow(label('recursion', ['function-calls', 'function-definitions', 'recursion']),
		ts,
		`fib <- function(n) {
			if (n <= 1) {
				return(n)
			}
			return(fib(n - 1) + fib(n - 2))
		}
		fib(5)
		`,
		emptyGraph()
			.call('1@<-', '<-', [argumentInCall('1@fib'), argumentInCall('1@function')], { onlyBuiltIn: true, omitArgs: true })
			.calls('1@<-', builtInId('function')).calls('1@<-', builtInId('assignment'))
			.call('7@fib', 'fib', [argumentInCall('7@5')], { omitArgs: true })
			.calls('7@fib', '1@function')
			.calls('7@fib', '3@return').calls('7@fib', '5@return')
			.defineFunction('1@function', [13, 31], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '2@if',
				graph:             new Set([1,5,6,7,11,13,14,15,18,19,20,22,24,25,26,28,29,31,32]),
				environment:       defaultEnv().pushEnv().defineParameter('n', '1@n', '1@n')
			}, { readParams: [[1, true]] })
			.calls('1@function', '3@return').calls('1@function', '5@return')
			.call('2@if', 'if', [argumentInCall(7), argumentInCall('2@return'), argumentInCall('5@return')], { onlyBuiltIn: true, omitArgs: true })
			.calls('2@if', builtInId('if-then-else')).calls('2@if', 14).calls('2@if', 7)
			.call(14, '{', [argumentInCall(13)], { omitArgs: true, onlyBuiltIn: true, controlDependencies: [{ id: 15, when: true }] })
			.calls(14, builtInId('expression-list')).calls(14, 13)
			.call('3@return', 'return', [argumentInCall('3@return')], { onlyBuiltIn: true, omitArgs: true, origin: ['builtin:return'], controlDependencies: [{ id: 15, when: true }] })
			.calls('3@return', builtInId('return'))
			.call(7, '<=', [argumentInCall('1@n'), argumentInCall('1@1')], { onlyBuiltIn: true, omitArgs: true })
			.calls(7, builtInId('default'))
			.call('5@return', 'return', [argumentInCall('5@return')], { onlyBuiltIn: true, omitArgs: true, origin: ['builtin:return'], controlDependencies: [{ id: 15, when: false }] })
			.calls('5@return', builtInId('return')).calls('5@return', '5@+')
			.call('5@+', '+', [argumentInCall('5@fib'), argumentInCall(28)], { onlyBuiltIn: true, omitArgs: true, controlDependencies: [{ id: 15, when: false } ] })
			.calls('5@+', builtInId('default')).calls('5@+', 22).calls('5@+', 28)
			.call(22, 'fib', [argumentInCall(24)], { omitArgs: true, controlDependencies: [{ id: 15, when: false }] })
			.calls(22, '1@function').calls(22, 20)
			.call(28, 'fib', [argumentInCall(26)], { omitArgs: true, controlDependencies: [{ id: 15, when: false }] })
			.calls(28, '1@function').calls(28, 26)
			.call(20, '-', [argumentInCall('1@n'), argumentInCall('1@1')], { onlyBuiltIn: true, omitArgs: true, controlDependencies: [{ id: 15, when: false }] })
			.calls(20, builtInId('default'))
			.call(26, '-', [argumentInCall('1@n'), argumentInCall('1@2')], { onlyBuiltIn: true, omitArgs: true, controlDependencies: [{ id: 15, when: false }] })
			.calls(26, builtInId('default'))
		, { context: 'call-graph', resolveIdsAsCriterion: true }
	);

	assertDataflow(label('with alias chain', ['function-calls', 'function-definitions', 'resolution', 'resolve-arguments']),
		ts,
		`increment <- function(a) {
				return(a + 1)
			}
			add <- increment
			foo <- add
			bar <- foo
			u <- bar(4)
			`,
		emptyGraph()
			.calls('7@bar', '1@function')
		, { context: 'call-graph', resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);

	assertDataflow(label('with alias in nest', ['function-calls', 'function-definitions', 'resolution', 'resolve-arguments']),
		ts,
		`increment <- function(a) {
				return(a + 1)
			}
			add <- function(b) {
				inc <- increment
				return(inc(b) + 2)
			}
			u <- add(4)
			`,
		emptyGraph()
			.calls('6@inc', '1@function')
			.calls('1@function', '2@return')
			.calls('8@<-', builtInId('assignment'))
			.calls('8@<-', '8@add')
		, { context: 'call-graph', resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);


	assertDataflow(label('higher-order fn', ['function-calls', 'function-definitions', 'resolution', 'resolve-arguments']),
		ts,
		`f <- function(g, x) {
				return(g(x) + 1)
			}
			increment <- function(a) {
				return(a + 1)
			}
			u <- f(increment, 5)
			`,
		emptyGraph()
			.calls('2@g', '4@function')
		, { context: 'call-graph', resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);

	assertDataflow(label('ping-pong-rec', ['function-calls', 'function-definitions', 'resolution', 'resolve-arguments', 'recursion']),
		ts,
		`a <- function(n) {
				if (n <= 0) {
					return(0)
				}
				return(b(n - 1) + 1)
		    }
		 	b <- function(n) {
				if (n <= 0) {
					return(0)
				}
				return(a(n - 1) + 1)
			}
			u <- a(5)
			`,
		emptyGraph()
			.calls('11@a', '1@function')
			.calls('5@b', '7@function')
		, { context: 'call-graph', resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);

	assertDataflow(label('call graph with scoped alias', ['function-calls', 'function-definitions', 'resolution', 'resolve-arguments', 'recursion']),
		ts,
		`g <- eval
f <- function(x) { g(x) }
f(1)`,
		emptyGraph()
			.calls('2@g', builtInId('eval'))
		, { context: 'call-graph', resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);

}));