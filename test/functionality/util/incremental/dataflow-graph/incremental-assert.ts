import { assert, test } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../../../src/project/flowr-analyzer';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { fileProtocol } from '../../../../../src/r-bridge/retriever';
import type { IncrementalUpdateResult, IncrementalUpdateType } from '../../../../../src/project/plugins/incremental/incremental-dataflow/flowr-analyzer-incremental-dataflow-update-type-plugin';
import { resolveOracle } from './incremental-oracles';
import { type FlowrAnalyzerIncrementalDataflowHeuristicPlugin, ConfiguredFlowrAnalyzerIncrementalDataflowHeuristicPlugin } from '../../../../../src/project/plugins/incremental/incremental-dataflow/flowr-analyzer-incremental-dataflow-heuristic-plugin';

/** The files of one step of an {@link assertIncrementalSequence}, by file name, the first file is the one analyzed. */
export type IncrementalFiles = Readonly<Record<string, string>>;

export interface IncrementalStep {
	readonly files:    IncrementalFiles;
	/** the update type the classification must produce for this step */
	readonly type?:    IncrementalUpdateType;
	/** whether the incremental analysis must (not) reuse anything for this step */
	readonly applied?: boolean;
}

/** Which incrementality the analyzer under test uses, see `incremental.dataflow.reuse` and `incremental.dataflow.activated`. */
export type IncrementalMode = 'reuse' | 'resume' | 'both';

export interface IncrementalSequenceOptions {
	/** the incrementality under test, `both` by default */
	readonly mode?:         IncrementalMode;
	/** the heuristic planning the incremental analysis, the one following the configuration literally by default (the analyzer's default is the adaptive one) */
	readonly heuristic?:    FlowrAnalyzerIncrementalDataflowHeuristicPlugin;
	/** the oracles to compare with, see {@link resolveOracle}, `:dataflow` by default */
	readonly oracles?:      readonly string[];
	/** see {@link FlowrConfig.incremental.dataflow.checkpoints} */
	readonly checkpoints?:  number;
	/** analyze all files of a step as requests, rather than only the first one */
	readonly allRequested?: boolean;
	/**
	 * Compare with a fresh analyzer for every step rather than with one that analyzes the steps one after the other without incrementality.
	 * An analyzer learns about the project as it analyzes it (e.g., the files a source call reads classify the project), so a repeated analysis may differ from a fresh one.
	 */
	readonly fresh?:        boolean;
}

async function buildAnalyzer(dir: string, files: IncrementalFiles, incremental: boolean, options: IncrementalSequenceOptions): Promise<FlowrAnalyzer> {
	const builder = new FlowrAnalyzerBuilder();
	if(incremental) {
		builder.registerPlugins(options.heuristic ?? new ConfiguredFlowrAnalyzerIncrementalDataflowHeuristicPlugin());
	}
	const analyzer = await builder
		.setParser(new TreeSitterExecutor())
		.amendConfig(c => {
			const mode = options.mode ?? 'both';
			c.incremental.dataflow.reuse = incremental && mode !== 'resume';
			c.incremental.dataflow.activated = incremental && mode !== 'reuse';
			if(options.checkpoints !== undefined) {
				c.incremental.dataflow.checkpoints = options.checkpoints;
			}
		})
		.build();
	const names = options.allRequested ? Object.keys(files) : [Object.keys(files)[0]];
	for(const name of names) {
		analyzer.addRequest(`${fileProtocol}${path.join(dir, name)}`);
	}
	return analyzer;
}

function writeFiles(dir: string, before: IncrementalFiles, after: IncrementalFiles): string[] {
	const touched: string[] = [];
	/* every file is written again, as saving it in an editor does, so that unchanged files are invalidated too */
	for(const [name, content] of Object.entries(after)) {
		fs.writeFileSync(path.join(dir, name), content);
		touched.push(name);
	}
	for(const name of Object.keys(before)) {
		if(!(name in after)) {
			fs.rmSync(path.join(dir, name), { force: true });
			touched.push(name);
		}
	}
	return touched;
}

function describeStep(i: number, step: IncrementalStep): string {
	return `step ${i} with files ${JSON.stringify(step.files)}`;
}

/**
 * Analyzes the steps one after the other with one incremental analyzer, and after every step compares it with a full analysis
 * of the same files, using every oracle in {@link IncrementalSequenceOptions#oracles}.
 * @returns the update the incremental analysis applied for every step after the first
 */
export async function runIncrementalSequence(steps: readonly IncrementalStep[], options: IncrementalSequenceOptions = {}): Promise<(IncrementalUpdateResult | undefined)[]> {
	const oracles = (options.oracles ?? [':dataflow']).map(resolveOracle);
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-incremental-'));
	const applied: (IncrementalUpdateResult | undefined)[] = [];
	try {
		writeFiles(dir, {}, steps[0].files);
		const incremental = await buildAnalyzer(dir, steps[0].files, true, options);
		const repeated = options.fresh ? undefined : await buildAnalyzer(dir, steps[0].files, false, options);
		for(let i = 0; i < steps.length; i++) {
			const step = steps[i];
			if(i > 0) {
				const before = steps[i - 1].files;
				const touched = writeFiles(dir, before, step.files);
				for(const analyzer of repeated ? [incremental, repeated] : [incremental]) {
					for(const name of touched) {
						analyzer.inspectContext().files.getFileByPath(path.join(dir, name))?.invalidate();
					}
					if(options.allRequested) {
						for(const name of Object.keys(step.files).filter(n => !(n in before))) {
							analyzer.addRequest(`${fileProtocol}${path.join(dir, name)}`);
						}
					}
				}
			}
			const full = repeated ?? await buildAnalyzer(dir, step.files, false, options);
			for(const oracle of oracles) {
				const got = await oracle.run(incremental);
				const expected = await oracle.run(full);
				oracle.assertMatches(got, expected, `${describeStep(i, step)} (${oracle.name})`);
			}
			if(i > 0) {
				const update = incremental.inspectContext().inc.getLastAppliedIncrementalUpdate();
				applied.push(update);
				if(step.type !== undefined) {
					assert.include(update?.types ?? [], step.type, `${describeStep(i, step)}: expected update type ${step.type}, got ${JSON.stringify(update)}`);
				}
				if(step.applied !== undefined) {
					assert.strictEqual(update?.applied ?? false, step.applied, `${describeStep(i, step)}: expected the incremental analysis ${step.applied ? '' : 'not '}to reuse the analysis before, got ${JSON.stringify(update)}`);
				}
			}
		}
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
	return applied;
}

/** Registers a test running {@link runIncrementalSequence}. */
export function assertIncrementalSequence(name: string, steps: readonly IncrementalStep[], options: IncrementalSequenceOptions = {}): void {
	test(name, async() => {
		await runIncrementalSequence(steps, options);
	});
}

/** A sequence of steps for a single file named `script.R`, one per code. */
export function singleFileSteps(...codes: readonly (string | Omit<IncrementalStep, 'files'> & { code: string })[]): IncrementalStep[] {
	return codes.map(c => typeof c === 'string' ? { files: { 'script.R': c } } : { ...c, files: { 'script.R': c.code } });
}
