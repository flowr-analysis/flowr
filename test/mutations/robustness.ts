import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../functionality/_helper/shell';
import { label } from '../functionality/_helper/label';
import type { KnownParser } from '../../src/r-bridge/parser';
import { FlowrAnalyzerBuilder } from '../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../src/r-bridge/retriever';
import { MutationPasses, mutate, type MutationPass, type MutationTarget } from '../functionality/_helper/r-mutations';
import { Counterexamples } from './counterexample-corpus';
import { ChainedWith } from '../functionality/_helper/r-mutations';

/** what a mutant may take to be analyzed and queried in full; a hang fails the test instead of the whole run */
const Timeout = 30_000;

/** analyzes `target` in full and asks the queries about it, none of which may fail */
async function analyzesFully(parser: KnownParser, { code, criterion }: MutationTarget): Promise<void> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
	analyzer.addRequest(requestFromInput(code));
	await analyzer.dataflow();
	await analyzer.controlflow();
	await analyzer.callGraph();
	const results = await analyzer.query([
		{ type: 'dependencies' }, { type: 'linter' }, { type: 'static-slice', criteria: [criterion] }, { type: 'resolve-value', criteria: [criterion] },
		{ type: 'inspect-fn-props' }, { type: 'inspect-exception' }, { type: 'inspect-higher-order' }, { type: 'inspect-recursion' }
	]);
	for(const [type, result] of Object.entries(results)) {
		assert.isUndefined((result as { error?: string }).error, `the ${type} query fails on:\n${code}`);
	}
}

/**
 * Every mutant of every counterexample, and every chain of a pass and the {@link ChainedWith} passes after it, is
 * analyzed in full and queried, which must neither fail, overflow the stack, nor hang. No R is needed for this, so
 * the passes run on tree-sitter, and the passes are split into `shards` files that vitest runs in parallel.
 */
export function robustnessChecks(shard: number, shards: number): void {
	describe(`analyzing mutants (${shard + 1}/${shards})`, withTreeSitter(parser => {
		MutationPasses.forEach((first, at) => {
			if(at % shards !== shard) {
				return;
			}
			const chains: readonly (MutationPass | undefined)[] = [undefined, ...Array.from({ length: ChainedWith }, (_, k) => MutationPasses[(at + k + 1) % MutationPasses.length])];
			describe(first.name, () => {
				for(const { group, cases } of Counterexamples) {
					for(const target of cases) {
						for(const second of chains) {
							test(label(`${group}: ${target.name}${second === undefined ? '' : ` then ${second.name}`}`, target.capabilities, ['other']), async ctx => {
								const once = await mutate(parser, target, first);
								const mutant = once === undefined || second === undefined ? once : await mutate(parser, once, second);
								if(mutant === undefined) {
									ctx.skip();
									return;
								}
								await analyzesFully(parser, mutant);
							}, Timeout);
						}
					}
				}
			});
		});
	}));
}
