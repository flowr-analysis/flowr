import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import { extractCfg, CfgEdge  } from '../../../src/control-flow/control-flow-graph';
import { assertCfgSatisfiesProperties } from '../../../src/control-flow/cfg-properties';
import { FlowrConfig } from '../../../src/config';

/**
 * Programs that put the control flow under pressure: jumps out of nested constructs, arms that never complete,
 * closures that are never called, and constructs that catch what happens within them.
 */
const criticalPrograms: Record<string, string> = {
	'loop in loop with both jumps':  'for(i in 1:3) { for(j in 1:3) { if(j > i) break else next }\nprint(i) }\nprint("after")',
	'break out of a nested if':      'while(TRUE) { if(a) { if(b) break }\nx <- 1 }\nprint(x)',
	'return out of a repeat':        'f <- function() { repeat { if(u) return(1) }\n2 }\nf()',
	'switch with fall-through arms': 'y <- switch(k, a = , b = 2, c = 3)\nprint(y)',
	'switch without a default':      'y <- switch(k, a = 1, b = 2)\nprint(y)',
	'nested function definitions':   'f <- function() { g <- function() { h <- function() 1\nh() }\ng() }\nf()',
	'recursion':                     'f <- function(n) if(n <= 1) 1 else n * f(n - 1)\nf(5)',
	'short circuit chain':           'if(a() && b() || c()) d() else e()',
	'assignment in a condition':     'while((n <- n - 1) > 0) print(n)',
	'nested replacement in a loop':  'for(i in 1:3) df$a[[i]]$b <- i\nprint(df)',
	'try around a loop':             'try({ while(TRUE) { if(u) break } })\nprint(1)',
	'tryCatch with finally':         'tryCatch({ stop("x") }, error = function(e) 1, finally = { cleanup() })\nprint(2)',
	'on.exit':                       'f <- function() { on.exit(cleanup())\nif(u) return(1)\n2 }\nf()',
	'closure that jumps':            'lapply(1:3, function(i) { if(i > 1) return(i)\n0 })',
	'pipe chain':                    'x |> f() |> g() |> h()',
	'if else if chain':              'if(a) 1 else if(b) 2 else if(c) 3 else 4',
	'loop that only jumps':          'while(u) { next }\nprint(1)',
	'stop in one branch':            'if(u) stop("x") else 1\nprint(2)',
	'defaults that use each other':  'f <- function(a = 1, b = a + 1, c = g(b)) a + b + c\nf()',
	'assignment in every form':      'x <- 1\n2 -> y\nz <<- 3\nassign("w", 4)\nprint(x + y + z + w)',
	'quote and eval':                'e <- quote(x + y)\neval(e)',
	'empty function and block':      'f <- function() {}\nf()\n{}',
	'a single expression':           '42',
	'nothing but a comment':         '# nothing here',
	'two loops leaving each other':  'while(a) { while(b) { break }\nbreak }\nprint(1)'
};

describe.sequential('Control Flow Graph', withTreeSitter(parser => {
	describe('holds together for critical programs', () => {
		test.each(Object.entries(criticalPrograms))('%s', async(_name, code) => {
			const context = contextFromInput(code, FlowrConfig.default());
			const result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
			const cfg = extractCfg(result.dataflow);
			const graph = cfg.graph;

			for(const [from, targets] of graph.edges()) {
				assert.isTrue(graph.hasVertex(from), `${from} has edges but is no vertex`);
				for(const [to, edge] of targets) {
					assert.isTrue(graph.hasVertex(to), `${to} is the target of an edge but is no vertex`);
					const back = graph.ingoingEdges(to)?.get(from);
					assert.isDefined(back, `${from} -> ${to} is missing from the reverse index`);
					assert.isTrue(CfgEdge.equals(back, edge), `${from} -> ${to} differs between the two indices`);
					assert.include([...graph.successors(from)], to, `${to} does not follow ${from}`);
					assert.include([...graph.predecessors(to)], from, `${from} does not precede ${to}`);
				}
			}

			for(const point of [...cfg.entryPoints, ...cfg.exitPoints]) {
				assert.isTrue(graph.hasVertex(point), `${point} is an entry or exit but no vertex`);
			}

			/* the reachability properties only hold without dead code, which several of these deliberately have */
			const properties = assertCfgSatisfiesProperties(cfg, ['single-entry-and-exit', 'entry-reaches-all', 'exit-reaches-all']);
			assert.isTrue(properties, `cfg fails ${properties}`);
		});
	});
}));
