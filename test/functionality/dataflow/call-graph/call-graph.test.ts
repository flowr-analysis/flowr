import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';

describe('Call Graph Generation', withTreeSitter(ts => {
	assertDataflow(label('sample calls', []),
		ts,
		`
		foo <- function(x) {
			return(x + 1)
		}
		bar <- function(y) {
			return(foo(y) * 2)
		}
		u <- bar(3)
		`, emptyGraph() // TODO: complete
			.call('2@return', 'return', [])
		,
		{ context: 'call-graph' }
	);

	assertDataflow(label('recursion', []),
		ts,
		`
		fib <- function(n) {
			if (n <= 1) {
				return(n)
			}
			return(fib(n - 1) + fib(n - 2))
		}
		fib(5)
		`, emptyGraph(),
		{ context: 'call-graph' }
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
}));