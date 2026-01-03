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
	});
}));
