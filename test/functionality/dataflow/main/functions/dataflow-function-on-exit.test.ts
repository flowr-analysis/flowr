import { assertDataflow, withShell } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import { defaultEnv } from '../../../_helper/dataflow/environment-builder';
import { type IdentifierReference, ReferenceType } from '../../../../../src/dataflow/environments/identifier';
import { type ExitPoint, ExitPointType } from '../../../../../src/dataflow/info';
import { KnownHooks } from '../../../../../src/dataflow/hooks';
import type { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

const fn = (nodeId: NodeId, name: string): IdentifierReference => ({ nodeId, name, type: ReferenceType.Function });
const variable = (nodeId: NodeId, name: string): IdentifierReference => ({ nodeId, name, cds: [], type: ReferenceType.Variable });
const returns = (nodeId: NodeId, cds?: ExitPoint['cds']): ExitPoint => ({ nodeId, type: ExitPointType.Return, ...cds ? { cds } : {} });
const hook = (id: string, add = false, after = true) => ({ type: KnownHooks.OnFnExit, id, add, after });

interface OnExitCase {
	readonly exits:             readonly NodeId[] | readonly ExitPoint[];
	readonly hooks:             readonly ReturnType<typeof hook>[];
	/** the hooks the function does not call, which are still registered */
	readonly uncalled?:         readonly string[];
	readonly in:                readonly IdentifierReference[];
	/** whether the second `x` reads the one on the third line, the closure of the hook */
	readonly readsLater?:       boolean;
	readonly mustNotHaveEdges?: readonly [string, string][];
}

describe('Function Definition - On.Exit', { concurrent: false }, withShell(shell => {
	function assertOnExit(name: string, code: string, { exits, hooks, uncalled, in: ins, readsLater, mustNotHaveEdges }: OnExitCase) {
		let graph = emptyGraph();
		for(const { id } of hooks.filter(h => !uncalled?.includes(h.id))) {
			graph = graph.calls('1@function', id);
		}
		graph = graph.defineFunction('1@function', exits, {
			hooks:             [...hooks],
			in:                [...ins],
			out:               [],
			unknownReferences: [],
			entryPoint:        '1@{',
			environment:       defaultEnv().pushEnv(),
			graph:             new Set([])
		});
		assertDataflow(label(name, ['normal-definition', 'implicit-return', 'name-normal', 'hooks']), shell, code,
			readsLater ? graph.reads('2@x', '3@x') : graph,
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true, mustNotHaveEdges: mustNotHaveEdges as [string, string][] | undefined }
		);
	}

	describe('Only functions', () => {
		assertOnExit('call on.exit at the end', 'function() { on.exit(1) }', {
			exits: [5], hooks: [hook('3-hook-fn')], in: [fn(5, 'on.exit'), fn(6, '{')]
		});
		assertOnExit('call on.exit with stuff afterward', 'function() { on.exit(1); return(2) }', {
			exits: [returns(9)], hooks: [hook('3-hook-fn')], in: [fn(5, 'on.exit'), fn(9, 'return'), fn(10, '{')]
		});
		assertOnExit('on.exit def should not apply until called', 'function() { x <- 1\n on.exit(x <- 2)\n return(x) }', {
			exits:            [returns(14)], hooks:            [hook('8-hook-fn')], in:               [fn(4, '<-'), fn(10, 'on.exit'), fn(14, 'return'), fn(15, '{')],
			mustNotHaveEdges: [['3@x', '2@x']]
		});
		// returns `on.exit`, no longer `return(x)`, but `return(x)` is **not** dead!
		assertOnExit('on.exit may overwrite exit points!', 'function() { x <- 1\n on.exit(return(2))\n return(x) }', {
			exits: [returns(9)], hooks: [hook('9-hook-fn')], in: [fn(4, '<-'), fn(11, 'on.exit'), fn(15, 'return'), fn(16, '{')]
		});
		assertOnExit('on.exit does not overwrite all, if it doesn\'t always exit`', 'function() { x <- 1\n on.exit(if(u) return(2))\n return(x) }', {
			exits: [returns(18), returns(10, [{ id: 12, when: true }])], hooks: [hook('12-hook-fn')],
			in:    [fn(4, '<-'), fn(14, 'on.exit'), fn(18, 'return'), fn(19, '{'), variable(6, 'u')]
		});
		assertOnExit('on.exit closure reads last value', 'function() { x <- 2;\non.exit(return(x));\nx <- 3; }', {
			exits:            [returns(9)], hooks:            [hook('9-hook-fn')], in:               [fn(4, '<-'), fn(11, 'on.exit'), fn(15, '<-'), fn(17, '{')],
			readsLater:       true, mustNotHaveEdges: [['2@x', '1@x']]
		});
		assertOnExit('by default, on.exit overwrite each other', 'function() { x <- 2;\non.exit(return(x));\nx <- 3;\non.exit(return(y)); }', {
			exits:            [returns('21')], hooks:            [hook('21-hook-fn')],
			in:               [fn(4, '<-'), fn(11, 'on.exit'), fn(15, '<-'), fn(23, 'on.exit'), fn(25, '{'), variable(19, 'y')],
			readsLater:       true, mustNotHaveEdges: [['2@x', '1@x'], ['1@function', '9-hook-fn']] // do not call first hook
		});
		assertOnExit('with add, on.exit\'s append', 'function() { x <- 2;\non.exit(x);\nx <- 3;\non.exit(return(y), add=TRUE); }', {
			exits:            [returns('18')], hooks:            [hook('6-hook-fn'), hook('18-hook-fn', true)],
			in:               [fn(4, '<-'), fn(12, '<-'), fn(8, 'on.exit'), fn(23, 'on.exit'), fn(25, '{'), variable(16, 'y')],
			readsLater:       true, mustNotHaveEdges: [['2@x', '1@x']]
		});
		assertOnExit('with add and before, on.exit\'s prepend', 'function() { x <- 2;\non.exit(x);\nx <- 3;\non.exit(return(y), add=TRUE, after=FALSE); }', {
			exits:            [returns('18')], hooks:            [hook('18-hook-fn', true, false), hook('6-hook-fn')],
			in:               [fn(4, '<-'), fn(12, '<-'), fn(8, 'on.exit'), fn(26, 'on.exit'), fn(28, '{'), variable(16, 'y')],
			readsLater:       true, mustNotHaveEdges: [['2@x', '1@x']]
		});
		assertOnExit('with add and before, on.exit\'s prepend (with exit points)', 'function() { x <- 2;\non.exit(return(x));\nx <- 3;\non.exit(return(y), add=TRUE, after=FALSE); }', {
			exits:            [returns('9')], hooks:            [hook('21-hook-fn', true, false), hook('9-hook-fn')],
			in:               [fn(4, '<-'), fn(15, '<-'), fn(11, 'on.exit'), fn(29, 'on.exit'), fn(31, '{'), variable(19, 'y')],
			readsLater:       true, mustNotHaveEdges: [['2@x', '1@x']]
		});
		assertOnExit('with add and before, on.exit\'s append (with exit points)', 'function() { x <- 2;\non.exit(return(x));\nx <- 3;\non.exit(return(y), add=TRUE, after=TRUE); }', {
			exits:            [returns('21')], hooks:            [hook('9-hook-fn'), hook('21-hook-fn', true)], uncalled:         ['9-hook-fn'],
			in:               [fn(4, '<-'), fn(15, '<-'), fn(11, 'on.exit'), fn(29, 'on.exit'), fn(31, '{'), variable(19, 'y')],
			readsLater:       true, mustNotHaveEdges: [['2@x', '1@x']]
		});
	});
}));
