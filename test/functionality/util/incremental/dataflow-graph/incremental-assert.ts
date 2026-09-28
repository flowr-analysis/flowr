import { assert, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { DeepWritable } from 'ts-essentials';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../../../src/project/flowr-analyzer';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { fileProtocol } from '../../../../../src/r-bridge/retriever';
import type { FlowrConfig } from '../../../../../src/config';
import {
	IncrementalUpdateType,
	type IncrementalUpdateResult
} from '../../../../../src/project/plugins/incremental/incremental-dataflow/flowr-analyzer-incremental-dataflow-update-type-plugin';
import { type IncrementalMutationType, resolveMutation } from './incremental-mutations';
import { resolveOracle } from './incremental-oracles';

export interface IncrementalDataflowTestOptions {
	readonly allowedMutations: IncrementalMutationType[];
	readonly oracle?:          string;
	/**
	 * `true`: the detector must trigger exactly `expectedType`.
	 * `false`: the detector may trigger `expectedType` or fall back to `Full`.
	 */
	readonly strict?:          boolean;
}

async function buildAnalyzer(request: string, amend: (config: DeepWritable<FlowrConfig>) => void): Promise<FlowrAnalyzer> {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setParser(new TreeSitterExecutor())
		.amendConfig(amend)
		.build();
	analyzer.addRequest(request);
	return analyzer;
}

function writeFileSet(dir: string, files: Record<string, string[]>): void {
	for(const [name, content] of Object.entries(files)) {
		fs.writeFileSync(path.join(dir, name), content.join('\n'));
	}
}

/** Writes the new file contents, removes files no longer present, and returns the set of touched file names. */
function applyFileChanges(dir: string, oldFiles: Record<string, string[]>, newFiles: Record<string, string[]>): Set<string> {
	const touched = new Set<string>();
	for(const [name, content] of Object.entries(newFiles)) {
		fs.writeFileSync(path.join(dir, name), content.join('\n'));
		touched.add(name);
	}
	for(const name of Object.keys(oldFiles)) {
		if(!(name in newFiles)) {
			fs.rmSync(path.join(dir, name), { force: true });
			touched.add(name);
		}
	}
	return touched;
}

function assertExpectedUpdateType(appliedUpdate: IncrementalUpdateResult | undefined, expectedUpdateType: IncrementalUpdateType, mutationType: string, strict: boolean | undefined): void {
	const hitExpectedType = appliedUpdate?.types.includes(expectedUpdateType) ?? false;
	const safeFallback = strict === false && appliedUpdate !== undefined && !appliedUpdate.applied;
	assert(
		hitExpectedType || safeFallback,
		`mutation "${mutationType}" should trigger ${expectedUpdateType}${strict === false ? ' or safely fall back to a full recompute' : ''}, got ${appliedUpdate ? `[${appliedUpdate.types.join(', ')}] (${appliedUpdate.applied ? 'applied' : 'not applied'})` : 'no incremental attempt'}`
	);
	if(strict !== false && hitExpectedType && expectedUpdateType !== IncrementalUpdateType.Full) {
		assert(appliedUpdate?.applied, `mutation "${mutationType}" triggered ${expectedUpdateType} but the orchestrator fell back to a full recompute instead of patching it`);
	}
}

/**
 * Applies each of `options.allowedMutations` to `files` in turn, and asserts that the resulting
 * incremental dataflow update matches the mutation's expected {@link IncrementalUpdateType} (or,
 * unless `strict`, safely falls back to a full recompute).
 */
export function assertIncrementalDataflowGraphMatches(files: Record<string, string>, options: IncrementalDataflowTestOptions): void {
	const oracle = resolveOracle(options.oracle ?? ':dataflow');
	const lineMap: Record<string, string[]> = Object.fromEntries(Object.entries(files).map(([name, content]) => [name, content.split('\n')]));
	const rootName = Object.keys(files)[0];

	if(options.allowedMutations.length === 0) {
		it.skip('no mutations configured yet', () => {});
		return;
	}

	for(const mutationType of options.allowedMutations) {
		const mutation = resolveMutation(mutationType);
		const mutated = mutation.apply(lineMap);
		const expectedUpdateType = mutation.expectedType;

		if(mutated === undefined) {
			it.skip(`${mutationType} (not applicable to this setup)`, () => {});
			continue;
		}
		const { oldFiles, newFiles } = mutated;

		it(mutationType, async() => {
			const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-incremental-mutation-'));
			try {
				writeFileSet(dir, oldFiles);
				const request = `${fileProtocol}${path.join(dir, rootName)}`;
				const analyzerIncremental = await buildAnalyzer(request, c => {
					c.incremental.dataflow.activated = true;
				});
				const analyzerNoIncremental = await buildAnalyzer(request, c => {
					c.incremental.dataflow.activated = false;
				});

				await oracle.run(analyzerIncremental);

				const touched = applyFileChanges(dir, oldFiles, newFiles);
				for(const name of touched) {
					analyzerIncremental.context().files.getFileByPath(path.join(dir, name))?.invalidate();
				}

				const incremental = await oracle.run(analyzerIncremental);
				assertExpectedUpdateType(analyzerIncremental.context().inc.getLastAppliedIncrementalUpdate(), expectedUpdateType, mutationType, options.strict);

				const full = await oracle.run(analyzerNoIncremental);
				oracle.assertMatches(incremental, full);
			} finally {
				fs.rmSync(dir, { recursive: true, force: true });
			}
		});
	}
}
