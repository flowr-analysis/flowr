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
			.defineFunction('4@function', [27], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '5@return',
				graph:             new Set([15, 21, 23, 24, 25, 27, 28]),
				environment:       defaultEnv().pushEnv().defineParameter('y', '4@y', '4@y')
			})
			.calls('4@function', '5@return')
			.defineFunction('1@function', [10], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '2@return',
				graph:             new Set([1, 6, 7, 8, 10, 11]),
				environment:       defaultEnv().pushEnv().defineParameter('x', '1@x', '1@x')
			})
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
	/*
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
			.defineFunction('1@function', [13, 31], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '2@if',
				graph:             new Set([1,5,6,7,11,13,14,15,18,19,20,22,24,25,26,28,29,31,32]),
				environment:       defaultEnv().pushEnv().defineParameter('n', '1@n', '1@n')
			})
		, { context: 'call-graph', resolveIdsAsCriterion: true }
	);

		assertDataflow(label('with alias', []),
			ts,
			`
			increment <- function(a) {
				return(a + 1)
			}
			add <- function(b) {
				inc <- increment
				return(inc(b) + 2)
			}
			u <- add(4)
			`, emptyGraph(),
			{ context: 'call-graph' }
		);

		assertDataflow(label('with alias', []),
			ts,
			`
			increment <- function(a) {
				return(a + 1)
			}
			add <- increment
			u <- add(4)
			`, emptyGraph(),
			{ context: 'call-graph' }
		);
		// TODO: add one with a higher-order function!
	 */
}));