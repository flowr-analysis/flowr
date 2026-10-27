import fs from 'fs';
import path from 'path';
import os from 'os';
import { TreeSitterExecutor } from '../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { ChainedWith, MutationPasses, mutate, type MutationPass, type MutationTarget } from '../functionality/_helper/r-mutations';
import { Counterexamples, type Counterexample } from './counterexample-corpus';

/** A mutant of the counterexample `target` in `group`, made by applying `passes` in turn, or the error making it raised. */
export interface Mutant {
	readonly group:   string;
	readonly target:  Counterexample;
	readonly passes:  readonly string[];
	readonly mutant?: Counterexample;
	readonly error?:  string;
}

/** The mutants of every counterexample, each program only once (see {@link setup}). */
export interface Mutants {
	/** the mutants of one pass */
	readonly once:    readonly Mutant[];
	/** the mutants of a pass followed by one of the {@link ChainedWith} passes after it */
	readonly chained: readonly Mutant[];
}

const MutantsFile = () => path.join(process.env.FLOWR_TEST_TMP ?? os.tmpdir(), 'flowr-mutants.json');

/**
 * Makes every mutant once before the shards run, so they share them: a mutant whose program and criterion equal those
 * of the counterexample, or of a mutant made before it, is left out, as checking it again checks nothing new. The
 * passes are text rewrites, so tree-sitter suffices to make them, whatever parser checks the mutants later on.
 */
export async function setup(): Promise<void> {
	await TreeSitterExecutor.initTreeSitter();
	const parser = new TreeSitterExecutor();
	const seen = new Set(Counterexamples.flatMap(({ cases }) => cases.map(keyOf)));
	const attempt = async(from: Counterexample, pass: MutationPass): Promise<{ mutant?: Counterexample, error?: string }> => {
		try {
			return { mutant: await mutate(parser, from, pass) as Counterexample | undefined };
		} catch(e) {
			return { error: e instanceof Error ? e.stack ?? e.message : String(e) };
		}
	};
	const keep = (into: Mutant[], made: Omit<Mutant, 'mutant' | 'error'>, { mutant, error }: { mutant?: Counterexample, error?: string }) => {
		if(error !== undefined) {
			into.push({ ...made, error });
		} else if(mutant !== undefined && !seen.has(keyOf(mutant))) {
			seen.add(keyOf(mutant));
			into.push({ ...made, mutant });
		}
	};
	const once: Mutant[] = [];
	/* what each pass makes of each counterexample, which the chains start from even where it repeats another mutant */
	const starts = new Map<string, Counterexample | undefined>();
	for(const { group, cases } of Counterexamples) {
		for(const target of cases) {
			for(const pass of MutationPasses) {
				const made = await attempt(target, pass);
				starts.set(`${pass.name}\0${group}\0${target.name}`, made.mutant);
				keep(once, { group, target, passes: [pass.name] }, made);
			}
		}
	}
	const chained: Mutant[] = [];
	for(const [at, first] of MutationPasses.entries()) {
		for(const { group, cases } of Counterexamples) {
			for(const target of cases) {
				const start = starts.get(`${first.name}\0${group}\0${target.name}`);
				for(let k = 1; start !== undefined && k <= ChainedWith; k++) {
					const second = MutationPasses[(at + k) % MutationPasses.length];
					keep(chained, { group, target, passes: [first.name, second.name] }, await attempt(start, second));
				}
			}
		}
	}
	parser.close();
	fs.writeFileSync(MutantsFile(), JSON.stringify({ once, chained } satisfies Mutants));
}

/** The mutants {@link setup} made for this run. */
export function mutants(): Mutants {
	return JSON.parse(fs.readFileSync(MutantsFile(), 'utf8')) as Mutants;
}

function keyOf({ code, criterion }: MutationTarget): string {
	return `${criterion}\0${code}`;
}
