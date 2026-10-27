import fs from 'fs';
import path from 'path';
import { describe, test, assert } from 'vitest';
import { skipWithoutRPackages, withShell } from '../functionality/_helper/shell';
import { decorateLabelContext, label } from '../functionality/_helper/label';
import type { RShell } from '../../src/r-bridge/shell';
import { Counterexamples, type Counterexample } from './counterexample-corpus';
import { MutationShardsDir, type MutationShardDetails } from './mutation-details';
import { mutants, originalKey, type Mutants } from './mutants';
import { rIsAtLeast } from '../functionality/_helper/r-version';
import type { MutationPass, ReplObservation } from '../functionality/_helper/r-mutations';
import { MutationPasses, observeQueries, observeRepl, removalSlice, slice } from '../functionality/_helper/r-mutations';


/** what a shard exercised, kept per shard as the shards of one worker share this module */
class Exercised {
	registered = 0;
	readonly checkedMutants = new Set<string>();
	readonly groups = new Set<string>();
	readonly targets = new Set<string>();
	readonly capabilities = new Set<string>();
}


function counterexamples(shell: RShell, exercised: Exercised, group: string, cases: readonly Counterexample[], { once, originals }: Mutants): void {
	exercised.groups.add(group);
	for(const { name, capabilities } of cases) {
		exercised.targets.add(`${group}: ${name}`);
		for(const capability of capabilities) {
			exercised.capabilities.add(capability);
		}
	}
	async function run(what: string): Promise<string> {
		/* a slice that drops what ends a loop runs forever, which must fail its test rather than hang the shell for every later one */
		const guarded = `tryCatch({ setTimeLimit(elapsed = 10, transient = TRUE); eval(parse(text = ${JSON.stringify(what)})) }, error = function(e) cat("R error:", conditionMessage(e), "\n"), finally = setTimeLimit())`;
		/* every program runs in a fresh directory of its own, so a slice dropping its `setwd` writes nothing into the repository */
		await shell.sendCommandWithOutput('flowr_wd <- getwd(); flowr_op <- options(); flowr_search <- search(); flowr_dir <- tempfile("flowr-run-"); dir.create(flowr_dir); setwd(flowr_dir)');
		const lines = await shell.sendCommandWithOutput(guarded, { automaticallyTrimOutput: true });
		/* a program may change the working directory or attach packages, which the next one must not see */
		await shell.sendCommandWithOutput('setwd(flowr_wd); unlink(flowr_dir, recursive = TRUE); options(flowr_op); graphics.off(); for(p in setdiff(search(), flowr_search)) try(detach(p, character.only = TRUE), silent = TRUE); rm(list = setdiff(ls(all.names = TRUE), "flowr_get_ast"))');
		return lines.join('\n');
	}
	const observed = new Map<string, Promise<ReplObservation>>();
	function replOf(target: Counterexample): Promise<ReplObservation> {
		const known = observed.get(target.code) ?? observeRepl(shell, target);
		observed.set(target.code, known);
		return known;
	}
	/** the REPL has to slice the program as the pipeline does and answer the same about it, unless the pass gives it a reason not to */
	async function checkRepl(target: Counterexample, original?: Counterexample, pass?: MutationPass): Promise<void> {
		const after = await replOf(target);
		const what = `the program is:\n${target.code}`;
		assert.strictEqual(await run(after.slice), target.expected, `the slice the REPL prints does not print what the input does, ${what}\nand the REPL slices it to:\n${after.slice}`);
		if(original === undefined || pass === undefined) {
			return;
		}
		const before = await replOf(original);
		assert.deepStrictEqual(after.dependencies, before.dependencies, `the mutation changes the dependencies the REPL lists, ${what}`);
		if(pass.adds) {
			assert.includeMembers([...after.linter], [...before.linter], `the mutation loses linter findings, ${what}`);
		} else {
			assert.deepStrictEqual(after.linter, before.linter, `the mutation changes the linter findings, ${what}`);
		}
		if(pass.keepsGraph) {
			assert.deepStrictEqual(after.graphs, before.graphs, `the mutation changes a value or graph the REPL shows, ${what}`);
		}
	}
	async function check(target: Counterexample): Promise<void> {
		const what = `the program sliced for ${target.criterion} is:\n${target.code}`;
		const sliced = await slice(shell, target);
		assert.strictEqual(await run(target.code), target.expected, `the input does not print what this test claims it does, ${what}`);
		const output = await run(sliced);
		const slicedIs = `${what}\nand its slice is:\n${sliced}`;
		assert.notMatch(sliced, /\bmut_[abc]\b/, `the slice keeps a binding nothing reads, ${slicedIs}`);
		assert.strictEqual(output, target.expected, `the slice does not print what the input does, ${slicedIs}`);
		/* removing what only the criterion needs leaves a program that still runs */
		const left = await removalSlice(shell, target);
		assert.notMatch(await run(left), /R error:/, `what the removal slice leaves fails, ${slicedIs}\nand what is left without it is:\n${left}`);
		/* a code fragment the slice must leave out, as far as the mutant still has it */
		for(const dropped of target.dropped ?? []) {
			if(target.code.includes(dropped)) {
				assert.notInclude(sliced, dropped, `the slice keeps what it does not need, ${slicedIs}`);
			}
		}
	}
	describe(group, () => {
		/* a program, or the one it is a mutant of, may use syntax this R cannot read, like the native pipe below R 4.1 */
		const readable = (name: string, minRVersion?: string) => rIsAtLeast(originals[originalKey(group, name)]) && rIsAtLeast(minRVersion);
		for(const counterexample of cases) {
			const { name, capabilities, code } = counterexample;
			test.runIf(readable(name))(`${decorateLabelContext(label(name, capabilities), ['slice', 'output'])} (input: ${JSON.stringify(code)})`, async({ skip }) => {
				await skipWithoutRPackages(code, skip);
				await check(counterexample);
				await checkRepl(counterexample);
			});
		}
		for(const pass of MutationPasses) {
			const ofPass = once.filter(m => m.group === group && m.passes[0] === pass.name && cases.some(c => c.name === m.target.name) && readable(m.target.name, m.minRVersion));
			if(ofPass.length === 0) {
				continue;
			}
			describe(pass.name, () => {
				for(const { target, mutant, error } of ofPass) {
					exercised.registered++;
					test(target.name, async({ skip }) => {
						await skipWithoutRPackages(target.code, skip);
						assert.isUndefined(error, `the pass fails on:\n${target.code}`);
						const checked = mutant as Counterexample;
						await check(checked);
						assert.deepStrictEqual(await observeQueries(shell, checked.code, checked.renames), await observeQueries(shell, target.code),
							`the mutation changes what the queries report about the program, it is:\n${checked.code}`);
						await checkRepl(checked, target, pass);
						exercised.checkedMutants.add(`${group}: ${target.name} [${pass.name}]`);
					});
				}
			});
		}
	});
}

/**
 * Checks every counterexample and its mutants against R, see {@link Counterexamples}. The cases are split into
 * `shards` files, each running on its own R shell, so vitest runs them in parallel; each shard records what it
 * exercised in {@link MutationShardsDir}, which the teardown of `mutation-details.ts` merges once all have run.
 * The mutants are those `mutants.ts` made once for all shards; a program this R cannot read is not run.
 */
export function counterexampleChecks(shard: number, shards: number): void {
	let at = 0;
	const mine = Counterexamples
		.map(({ group, cases }) => ({ group, cases: cases.filter(() => at++ % shards === shard) }))
		.filter(({ cases }) => cases.length > 0);
	const made = mutants();
	describe(`Counterexamples against R semantics (${shard + 1}/${shards})`, { concurrent: false }, withShell(shell => {
		const exercised = new Exercised();
		for(const { group, cases } of mine) {
			counterexamples(shell, exercised, group, cases, made);
		}
		test('record what this shard exercised', ctx => {
			if(exercised.checkedMutants.size < exercised.registered) {
				ctx.skip();
				return;
			}
			fs.mkdirSync(MutationShardsDir, { recursive: true });
			const shardDetails: MutationShardDetails = {
				shards, groups: [...exercised.groups], counterexamples: exercised.targets.size, capabilities: [...exercised.capabilities], mutants: exercised.checkedMutants.size
			};
			fs.writeFileSync(path.join(MutationShardsDir, `${shard}.json`), JSON.stringify(shardDetails));
		});
	}));
}
