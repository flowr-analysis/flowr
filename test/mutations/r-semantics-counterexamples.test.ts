import fs from 'fs';
import path from 'path';
import { describe, test, assert } from 'vitest';
import { withShell } from '../functionality/_helper/shell';
import { decorateLabelContext, label } from '../functionality/_helper/label';
import type { RShell } from '../../src/r-bridge/shell';
import { Counterexamples, type Counterexample } from './counterexample-corpus';
import type { MutationPass, ReplObservation } from '../functionality/_helper/r-mutations';
import { MutationPasses, mutate, observeQueries, observeRepl, passIsAvailable, removalSlice, slice } from '../functionality/_helper/r-mutations';


const generatedMutants = new Set<string>();
const attemptedMutants = new Set<string>();
const usedPasses = new Set<string>();
const knownGroups = new Set<string>();
const knownTargets = new Set<string>();
const knownCapabilities = new Set<string>();

const MutationDetailsFile = 'coverage/flowr-mutation-details.json';

function counterexamples(shell: RShell, group: string, cases: readonly Counterexample[]): void {
	knownGroups.add(group);
	for(const { name, capabilities } of cases) {
		knownTargets.add(`${group}: ${name}`);
		for(const capability of capabilities) {
			knownCapabilities.add(capability);
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
	async function check(target: Counterexample, pass?: MutationPass): Promise<void> {
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
		/* a slice keeps a call it needs whole, so what a pass moved into one stays with it */
		for(const lacked of pass?.wrapsInCall ? [] : target.lacks ?? []) {
			if(target.code.includes(lacked)) {
				assert.notInclude(sliced, lacked, `the slice keeps what it does not need, ${slicedIs}`);
			}
		}
	}
	describe(group, () => {
		for(const counterexample of cases) {
			const { name, capabilities, code } = counterexample;
			test(`${decorateLabelContext(label(name, capabilities), ['slice', 'output'])} (input: ${JSON.stringify(code)})`, async() => {
				await check(counterexample);
				await checkRepl(counterexample);
			});
		}
		for(const pass of MutationPasses) {
			describe(pass.name, () => {
				for(const counterexample of cases) {
					const id = `${group}: ${counterexample.name} [${pass.name}]`;
					test(counterexample.name, async(ctx) => {
						attemptedMutants.add(id);
						const mutant = await mutate(shell, counterexample, pass);
						if(mutant === undefined) {
							ctx.skip();
							return;
						}
						generatedMutants.add(id);
						usedPasses.add(pass.name);
						await check(mutant as Counterexample, pass);
						assert.deepStrictEqual(await observeQueries(shell, mutant.code, mutant.renames), await observeQueries(shell, counterexample.code),
							`the mutation changes what the queries report about the program, it is:\n${mutant.code}`);
						await checkRepl(mutant as Counterexample, counterexample, pass);
					});
				}
			});
		}
	});
}

describe('Counterexamples against R semantics', { concurrent: false }, withShell(shell => {
	for(const { group, cases } of Counterexamples) {
		counterexamples(shell, group, cases);
	}

	describe('bookkeeping', () => {
		const partialRun = () => attemptedMutants.size < knownTargets.size * MutationPasses.length;
		test('every pass mutates at least one counterexample', ctx => {
			if(partialRun()) {
				ctx.skip();
				return;
			}
			const idle = MutationPasses.filter(passIsAvailable).map(p => p.name).filter(name => !usedPasses.has(name));
			assert.deepStrictEqual(idle, [], 'these passes never applied, so nothing they claim to check is checked');
		});
		test('record what this run exercised', ctx => {
			if(partialRun()) {
				ctx.skip();
				return;
			}
			assert.isAbove(generatedMutants.size, 0, 'nothing was mutated, so there is no run to record');
			fs.mkdirSync(path.dirname(MutationDetailsFile), { recursive: true });
			fs.writeFileSync(MutationDetailsFile, JSON.stringify({
				passes:          MutationPasses.length,
				groups:          knownGroups.size,
				counterexamples: knownTargets.size,
				capabilities:    knownCapabilities.size,
				mutants:         generatedMutants.size
			}));
		});
	});
}));
