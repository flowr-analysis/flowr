import { assertDataflow, withShell } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import { defaultEnv } from '../../../_helper/dataflow/environment-builder';
import { ReferenceType } from '../../../../../src/dataflow/environments/identifier';
import { ExitPointType } from '../../../../../src/dataflow/info';

describe.sequential('Function Definition - On.Exit', withShell(shell => {
	describe('Only functions', () => {
		assertDataflow(label('call on.exit at the end', ['normal-definition', 'implicit-return', 'name-normal', 'hooks']),
			shell, 'function() { on.exit(1) }',
			emptyGraph()
				.calls('1@function', '3-hook-fn')
				.defineFunction('1@function', [5], {
					hooks: [], // they do not propagate
					in:    [
						{ nodeId: 5, name: 'on.exit', type: ReferenceType.Function },
						{ nodeId: 6, name: '{', type: ReferenceType.Function }
					],
					out:               [],
					unknownReferences: [],
					entryPoint:        '1@{',
					environment:       defaultEnv().pushEnv(),
					graph:             new Set([])
				}), {
				resolveIdsAsCriterion: true,
				expectIsSubgraph:      true
			}
		);
		assertDataflow(label('call on.exit with stuff afterward', ['normal-definition', 'implicit-return', 'name-normal', 'hooks']),
			shell, 'function() { on.exit(1); return(2) }',
			emptyGraph()
				.calls('1@function', '3-hook-fn')
				.defineFunction('1@function', [{ nodeId: 9, type: ExitPointType.Return }], {
					hooks: [], // they do not propagate
					in:    [
						{ nodeId: 5, name: 'on.exit', type: ReferenceType.Function },
						{ nodeId: 9, name: 'return', type: ReferenceType.Function },
						{ nodeId: 10, name: '{', type: ReferenceType.Function }
					],
					out:               [],
					unknownReferences: [],
					entryPoint:        '1@{',
					environment:       defaultEnv().pushEnv(),
					graph:             new Set([])
				}), {
				resolveIdsAsCriterion: true,
				expectIsSubgraph:      true
			}
		);
		assertDataflow(label('on.exit def should not apply until called', ['normal-definition', 'implicit-return', 'name-normal', 'hooks']),
			shell, 'function() { x <- 1\n on.exit(x <- 2)\n return(x) }',
			emptyGraph()
				.calls('1@function', '8-hook-fn')
				.defineFunction('1@function', [{ nodeId: 14, type: ExitPointType.Return }], {
					hooks: [], // they do not propagate
					in:    [
						{ nodeId: 4, name: '<-', type: ReferenceType.Function },
						{ nodeId: 10, name: 'on.exit', type: ReferenceType.Function },
						{ nodeId: 14, name: 'return', type: ReferenceType.Function },
						{ nodeId: 15, name: '{', type: ReferenceType.Function },

					],
					out:               [],
					unknownReferences: [],
					entryPoint:        '1@{',
					environment:       defaultEnv().pushEnv(),
					graph:             new Set([])
				}), {
				resolveIdsAsCriterion: true,
				expectIsSubgraph:      true,
				mustNotHaveEdges:      [['3@x', '2@x']]
			}
		);
		assertDataflow(label('on.exit may overwrite exit points!', ['normal-definition', 'implicit-return', 'name-normal', 'hooks']),
			shell, 'function() { x <- 1\n on.exit(return(2))\n return(x) }',
			emptyGraph()
				.calls('1@function', '9-hook-fn')
				// returns `on.exit`, no longer `return(x)`, but `return(x)` is **not** dead!
				.defineFunction('1@function', [{ nodeId: 9, type: ExitPointType.Return }], {
					hooks: [], // they do not propagate
					in:    [
						{ nodeId: 4, name: '<-', type: ReferenceType.Function },
						{ nodeId: 11, name: 'on.exit', type: ReferenceType.Function },
						{ nodeId: 15, name: 'return', type: ReferenceType.Function },
						{ nodeId: 16, name: '{', type: ReferenceType.Function },

					],
					out:               [],
					unknownReferences: [],
					entryPoint:        '1@{',
					environment:       defaultEnv().pushEnv(),
					graph:             new Set([])
				}), {
				resolveIdsAsCriterion: true,
				expectIsSubgraph:      true,
			}
		);
		assertDataflow(label('on.exit does not overwrite all, if it doesnt always exit`', ['normal-definition', 'implicit-return', 'name-normal', 'hooks']),
			shell, 'function() { x <- 1\n on.exit(if(u) return(2))\n return(x) }',
			emptyGraph()
				.calls('1@function', '12-hook-fn')
				// returns `on.exit`, no longer `return(x)`, but `return(x)` is **not** dead!
				.defineFunction('1@function', [ { nodeId: 18, type: ExitPointType.Return }, { nodeId: 10, type: ExitPointType.Return, controlDependencies: [{ id: 12, when: true }] }], {
					hooks: [], // they do not propagate
					in:    [
						{ nodeId: 4, name: '<-', type: ReferenceType.Function },
						{ nodeId: 14, name: 'on.exit', type: ReferenceType.Function },
						{ nodeId: 18, name: 'return', type: ReferenceType.Function },
						{ nodeId: 19, name: '{', type: ReferenceType.Function },

					],
					out:               [],
					unknownReferences: [],
					entryPoint:        '1@{',
					environment:       defaultEnv().pushEnv(),
					graph:             new Set([])
				}), {
				resolveIdsAsCriterion: true,
				expectIsSubgraph:      true,
			}
		);

		assertDataflow(label('on.exit closure reads last value`', ['normal-definition', 'implicit-return', 'name-normal', 'hooks']),
			shell, 'function() { x <- 2;\non.exit(return(x));\nx <- 3; }',
			emptyGraph()
				.calls('1@function', '9-hook-fn')
				.defineFunction('1@function', [ { nodeId: 9, type: ExitPointType.Return }], {
					hooks: [], // they do not propagate
					in:    [
						{ nodeId: 4, name: '<-', type: ReferenceType.Function },
						{ nodeId: 11, name: 'on.exit', type: ReferenceType.Function },
						{ nodeId: 15, name: '<-', type: ReferenceType.Function },
						{ nodeId: 17, name: '{', type: ReferenceType.Function }
					],
					out:               [],
					unknownReferences: [],
					entryPoint:        '1@{',
					environment:       defaultEnv().pushEnv(),
					graph:             new Set([])
				})
				.reads('2@x', '3@x'), {
				resolveIdsAsCriterion: true,
				expectIsSubgraph:      true,
				mustNotHaveEdges:      [['2@x', '1@x']]
			}
		);
	});
}));
