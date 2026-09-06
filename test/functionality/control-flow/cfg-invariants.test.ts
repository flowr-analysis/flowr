import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import { extractCfg, CfgEdge  } from '../../../src/control-flow/control-flow-graph';
import { assertCfgSatisfiesProperties } from '../../../src/control-flow/cfg-properties';
import { visitCfgInOrder } from '../../../src/control-flow/simple-visitor';
import { VertexType } from '../../../src/dataflow/graph/vertex';
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
	'return in an argument':         'f(u, { if(u) return()\n1 })\nprint(2)',
	'return in every argument':      'f({ if(u) return() }, { if(v) return() })\nprint(2)',
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

	/** A jump within an argument leaves the call only when it always happens, so the default exit stays. */
	describe('a conditional jump within an argument still lets the call complete', () => {
		const programs: Record<string, string> = {
			'return in one argument':      'f(u, { if(u) return()\n1 })\nprint(2)',
			'return in every argument':    'f({ if(u) return() }, { if(v) return() })\nprint(2)',
			'return behind a condition':   'observeEvent(u, { if(is.null(u)) { return() }\nx <- 1 })\ny <- 2\nprint(y)',
			'break in one argument':       'while(u) { f({ if(u) break\n1 })\nprint(1) }\nprint(2)',
			'next in one argument':        'for(i in 1:3) { f({ if(u) next\n1 })\nprint(1) }\nprint(2)',
			'nested calls that return':    'f(g({ if(u) return()\n1 }))\nprint(2)',
			'a jump in a named argument':  'f(x = { if(u) return()\n1 }, y = 2)\nprint(2)',
			'stop in an argument':         'f({ if(u) stop("x")\n1 })\nprint(2)',
			'a jump within a replacement': 'df$a[if(u) 1 else 2] <- 3\nprint(2)',
			'a jump within an assignment': 'x <<- { if(u) return()\n1 }\nprint(2)',
			/* the expression is held on to, never evaluated, so what it says about control flow says nothing */
			'a return within a quote':     'e <- quote({ return(1) })\nprint(2)',
			'a return within bquote':      'e <- bquote({ return(1) })\nprint(2)',
			'an always-jumping quote':     'e <- quote(return(1))\nprint(2)',
			/* an error the block raises is what the handler is there for, so it has to be able to run */
			'tryCatch with a handler':     'tryCatch({ stop("x") }, error = function(e) 1)\nprint(2)',
			'tryCatch with a finally':     'tryCatch({ stop("x") }, error = function(e) 1, finally = { cleanup() })\nprint(2)',
			'tryCatch without a handler':  'tryCatch({ stop("x") }, finally = { cleanup() })\nprint(2)'
		};

		test.each(Object.entries(programs))('%s', async(_name, code) => {
			const context = contextFromInput(code, FlowrConfig.default());
			const result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
			const cfg = extractCfg(result.dataflow);
			const reached = visitCfgInOrder(cfg.graph, cfg.entryPoints, () => { /* only collect */ });

			assert.isTrue(reached.has(cfg.exitPoints[0]), 'the program can still be run to its end');
		});
	});

	/** Nothing a program is made of sits beside the control flow with no edge leading to it at all. */
	test.each([
		['break in a block', 'while(u) { if(v) { break } }\nprint(2)'],
		['next in a block',  'for(i in 1:3) { if(v) { next } }\nprint(2)'],
		['stop in a block',  'if(u) { stop("x") }\nprint(2)'],
		['return in a block', 'f <- function() { if(u) { return(1) }\n2 }\nf()'],
		['nested blocks',    'while(u) { if(v) { { break } } }\nprint(2)']
	])('no vertex is left beside the control flow (%s)', async(_name, code) => {
		const context = contextFromInput(code, FlowrConfig.default());
		const result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
		const cfg = extractCfg(result.dataflow);
		const orphans = [...cfg.graph.rootIds()].filter(id =>
			[...cfg.graph.predecessors(id)].length === 0 && [...cfg.graph.successors(id)].length === 0
			&& !cfg.entryPoints.includes(id) && !cfg.exitPoints.includes(id));

		assert.deepStrictEqual(orphans, [], 'every vertex is wired into the flow');
	});

	/** The handler of a `tryCatch` is what an error the block raises is for, so the error has to reach it. */
	test('a caught error reaches the handler', async() => {
		const context = contextFromInput('tryCatch({ stop("x") }, error = function(e) 1, finally = { cleanup() })\nprint(2)', FlowrConfig.default());
		const result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
		const cfg = extractCfg(result.dataflow);
		const reached = visitCfgInOrder(cfg.graph, cfg.entryPoints, () => { /* only collect */ });
		const handlers = [...result.dataflow.graph.verticesOfType(VertexType.FunctionDefinition)].map(([id]) => id);

		assert.lengthOf(handlers, 1, 'the handler is the only function the program defines');
		assert.isTrue(reached.has(handlers[0]), 'and the error the block always raises gets to it');
	});

	/** An argument that always jumps does leave the call, so what follows is dead. */
	test('an unconditional jump within an argument does leave the call', async() => {
		const context = contextFromInput('f({ return() })\nprint(2)', FlowrConfig.default());
		const result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
		const cfg = extractCfg(result.dataflow);
		const reached = visitCfgInOrder(cfg.graph, cfg.entryPoints, () => { /* only collect */ });
		const follows = [...result.dataflow.graph.verticesOfType(VertexType.FunctionCall)]
			.find(([, v]) => v.name === 'print')?.[0];

		assert.isFalse(follows !== undefined && reached.has(follows), 'what follows the call is dead');
	});
}));
