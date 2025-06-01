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
		describe.each([
			{ prefix: 'if(TRUE)', swap: false },
			{ prefix: 'if(FALSE)', swap: true },
			{ prefix: 'x <- TRUE; if(x)', swap: false },
			{ prefix: 'x <- FALSE; if(x)', swap: true }
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
	});
}));
