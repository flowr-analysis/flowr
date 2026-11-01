import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../functionality/_helper/shell';
import { label } from '../functionality/_helper/label';
import type { KnownParser } from '../../src/r-bridge/parser';
import { FlowrAnalyzerBuilder } from '../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../src/r-bridge/retriever';
import type { ChainedWith, MutationTarget } from '../functionality/_helper/r-mutations';
import { mutants } from './mutants';

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
 * analyzed in full and queried, which must neither fail, overflow the stack, nor hang. Each program is analyzed only
 * once (see `mutants.ts`), and no R is needed for this, so the mutants are split into `shards` files that vitest runs
 * in parallel on tree-sitter.
 */
export function robustnessChecks(shard: number, shards: number): void {
	const { once, chained } = mutants();
	const mine = [...once, ...chained].filter((_, at) => at % shards === shard);
	describe(`analyzing mutants (${shard + 1}/${shards})`, withTreeSitter(parser => {
		for(const { group, target, passes, mutant, error } of mine) {
			test(label(`${group}: ${target.name} by ${passes.join(' then ')}`, target.capabilities, ['other']), async() => {
				assert.isUndefined(error, `the pass fails on:\n${target.code}`);
				await analyzesFully(parser, mutant as MutationTarget);
			}, Timeout);
		}
	}));
}
