import { withTreeSitter } from '../../_helper/shell';
import { describe } from 'vitest';
import { assertCfg } from '../../_helper/controlflow/assert-control-flow-graph';
import { ControlFlowGraph } from '../../../../src/control-flow/control-flow-graph';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { tryResolveSliceCriterionToId } from '../../../../src/slicing/criterion/parse';
import { canReach } from '../../../../src/control-flow/simple-visitor';

interface CfgDeadCodeArgs {
	readonly reachableFromStart:   readonly NodeId[];
	readonly unreachableFromStart: readonly NodeId[];
}

describe('Control Flow Graph', withTreeSitter(parser => {
	function assertDeadCode(code: string, { reachableFromStart, unreachableFromStart } : CfgDeadCodeArgs): void {
		assertCfg(parser, code, {
			graph: new ControlFlowGraph()
		}, {
			expectIsSubgraph:     true,
			simplificationPasses: ['analyze-dead-code'],
			/** we break unreachable edges for this test, the whole point is for not all of them being reachable */
			excludeProperties:    ['entry-reaches-all', 'exit-reaches-all'],
			additionalAsserts:    (cfg, ast) => {
				for(const [n, i] of [...reachableFromStart.map(n => [n, false] as const), ...unreachableFromStart.map(n => [n, true] as const)]) {
					const resolved = tryResolveSliceCriterionToId(n, ast.idMap) ?? n;
					if(i === canReach(cfg.graph, cfg.entryPoints, resolved)) {
						throw new Error(`Expected node ${n} (${resolved}) to be ${i ? 'unreachable' : 'reachable'} from the start (${JSON.stringify(cfg.entryPoints)}), but it is not.`);
					}
				}
			}
		});
	}


	describe('Dead Code Removal', () => {
		describe('Empty Vector', () => {
			assertDeadCode('x<-1\nfor (i in c())\n{ print(i) }', { reachableFromStart: ['1@x', '2@i'], unreachableFromStart: ['3@i'] });
			assertDeadCode('x<-1; y <- c()\nfor (i in y)\n{ print(i) }', { reachableFromStart: ['1@x', '2@i'], unreachableFromStart: ['3@i'] });
			// c <- function() 1:10
			// ------
			// f <- function(p = c()) { for(i in p) { x <- 2} } --> not dead 
			// one more indirection 
			// detect loop that is not dead 
			// nested 
			
			/** 
		     * f <- function() {
		     * 	for(i in c()) {}
		     *    function() i <<- 42
		     * }
		     * 
		     * g <- f()
		     * g()
		     * 
		     * > i
    		 * Error: object 'i' not found
    		 * > for(i in c()) {}
    		 * > i
    		 * NULL
			 */
			
			/// ------------------------------------
			// doesItLoopyOnlyOncey(<...>)
			// for(i in c(1)) { print(42) }
			// while(TRUE) { print(2); [break|stopifnot()];  }
			// for(i in 1:10) { print(42); break }
			// for(i in 1:10) { print(42); if(u) break else break } 
			// x <- 2; while(TRUE) { x <- x + 1; break } 
			// a:b (1:9, 9:1) | seq | seq_along |
		});

		describe.each([
			{ prefix: 'if(TRUE)', swap: false },
			{ prefix: 'if(FALSE)', swap: true },
			{ prefix: 'x <- TRUE; if(x)', swap: false },
			{ prefix: 'x <- FALSE; if(x)', swap: true },
		])('if-else branches', ({ prefix, swap }) => {
			let reachableFromStart = ['1@1'];
			let unreachableFromStart = ['1@2'];
			if(swap) {
				[reachableFromStart, unreachableFromStart] = [unreachableFromStart, reachableFromStart];
			}
			assertDeadCode(prefix + '1 else 2',
				{ reachableFromStart, unreachableFromStart }
			);
		});

		describe('if-elseif-else branches', () => {
			assertDeadCode('if(TRUE) 1 else if (FALSE) 2 else 3',  { reachableFromStart: ['1@1'],  unreachableFromStart: ['1@2', '1@3'] });
			assertDeadCode('if(FALSE) 1 else if (FALSE) 2 else 3', { reachableFromStart: ['1@3'],  unreachableFromStart: ['1@1', '1@2'] });
			assertDeadCode('if(FALSE) 1 else if (TRUE) 2 else 3',  { reachableFromStart: ['1@2'],  unreachableFromStart: ['1@1', '1@3'] });
		});

		describe('stopifnot(TRUE)', () => {
			assertDeadCode('if(TRUE) 1; stopifnot(TRUE); 2',  { reachableFromStart: ['1@1', '1@2'],  unreachableFromStart: [] });
		});

		describe.each([
			{ prefix: 'while(TRUE)', swap: false },
			{ prefix: 'while(FALSE)', swap: true },
			{ prefix: 'x <- TRUE; while(x)', swap: false },
			{ prefix: 'x <- FALSE; while(x)', swap: true }
		])('while branches', ({ prefix, swap }) => {
			let reachableFromStart = ['1@1'];
			let unreachableFromStart = ['1@2'];
			if(swap) {
				[reachableFromStart, unreachableFromStart] = [unreachableFromStart, reachableFromStart];
			}
			assertDeadCode(prefix + ' { 1 }; 2',
				{ reachableFromStart, unreachableFromStart }
			);
		});

		describe.each([
			{ prefix: 'function()',    loop: false },
			{ prefix: '\\(bar)',       loop: false },
			{ prefix: 'for(i in 1:3)', loop: true },
			{ prefix: 'while(TRUE)',   loop: true },
			{ prefix: 'repeat',        loop: true },
			{ prefix: 'if(TRUE)',      loop: false },
			{ prefix: 'if(bar)',       loop: false },
		])('code after return', ({ prefix, loop }) => {
			const verbs = loop ? ['return(1)', 'break', 'next', 'stop(1)', 'stopifnot(FALSE)'] : ['return(1)', 'stop(1)', 'stopifnot(FALSE)'];
			for(const verb of verbs) {
				assertDeadCode(`${prefix}{ foo; ${verb}; 2 }`, { reachableFromStart: ['1@foo'],  unreachableFromStart: ['1@2'] });
			}
		});

		describe.each([
			{ prefix: 'while(TRUE)' },
			{ prefix: 'repeat' },
		])('code after infinite loop', ({ prefix }) => {
			assertDeadCode(`${prefix}{ foo }; 2`, { reachableFromStart: ['1@foo'],  unreachableFromStart: ['1@2'] });
		});

		describe('nested', () => {
			const outers = ['while (TRUE)', 'repeat', 'for (i in 1:10)'];
			const inners = ['break', 'return(42)', 'next', 'stop(42)', 'stopifnot(FALSE)'];

			for(const outer of outers) {
				for(const inner1 of inners) {
					for(const inner2 of inners) {
						assertDeadCode(`${outer} { 1; if(u) ${inner1} else ${inner2}; 2 }`, { reachableFromStart: ['1@1'], unreachableFromStart: ['1@2'] });
						assertDeadCode(`${outer} { 1; if(TRUE) ${inner1} else ${inner2}; 2 }`, { reachableFromStart: ['1@1'], unreachableFromStart: ['1@2'] });
					}
				}
			}
		});
	});
}));
