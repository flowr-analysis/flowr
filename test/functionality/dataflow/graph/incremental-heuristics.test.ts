import { assert, describe, test } from 'vitest';
import { SemVer } from 'semver';
import { IncrementalUpdateType } from '../../../../src/project/plugins/incremental/incremental-dataflow/flowr-analyzer-incremental-dataflow-update-type-plugin';
import {
	AdaptiveFlowrAnalyzerIncrementalDataflowHeuristicPlugin,
	FlowrAnalyzerIncrementalDataflowHeuristicPlugin,
	type IncrementalDataflowPlan
} from '../../../../src/project/plugins/incremental/incremental-dataflow/flowr-analyzer-incremental-dataflow-heuristic-plugin';
import { assertIncrementalSequence, singleFileSteps } from '../../util/incremental/dataflow-graph/incremental-assert';
import { fuzzedSequence } from '../../util/incremental/dataflow-graph/incremental-mutations';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

/** A heuristic that never builds on the analysis before. */
class NeverIncremental extends FlowrAnalyzerIncrementalDataflowHeuristicPlugin {
	public readonly name = 'never-incremental';
	public readonly description = 'Starts every dataflow analysis over.';
	public readonly version = new SemVer('0.0.1');
	protected process(): IncrementalDataflowPlan {
		return { reuse: false, checkpoints: 0, minStatements: 0 };
	}
}

const base = 'x <- 1\ny <- 2\nprint(x + y)';

describe('incremental dataflow heuristics', () => {
	describe('adaptive', () => {
		const adaptive = () => new AdaptiveFlowrAnalyzerIncrementalDataflowHeuristicPlugin();
		assertIncrementalSequence('keeps no checkpoint on the first analysis', singleFileSteps(base,
			{ code: `${base}\nz <- x`, type: IncrementalUpdateType.AddedAtEnd, applied: false },
			{ code: `${base}\nz <- x\nw <- z`, type: IncrementalUpdateType.AddedAtEnd, applied: true },
			{ code: `${base}\nz <- x\nw <- z # c`, applied: true }
		), { mode: 'reuse', heuristic: adaptive() });
		assertIncrementalSequence('reuses from the first analysis on', singleFileSteps(base, { code: `${base} # c`, applied: true }), { mode: 'reuse', heuristic: adaptive() });
		assertIncrementalSequence('resumes where the last change happened', singleFileSteps(`${base}\nz <- x`,
			{ code: 'x <- 1\ny <- 3\nprint(x + y)\nz <- x', type: IncrementalUpdateType.ChangedAtEnd, applied: false },
			{ code: 'x <- 1\ny <- 4\nprint(x + y)\nz <- x', type: IncrementalUpdateType.ChangedAtEnd, applied: true },
			{ code: 'x <- 1\ny <- 4\nprint(x + y)\nz <- y', type: IncrementalUpdateType.ChangedAtEnd, applied: true },
			{ code: 'x <- 1\ny <- 4\nprint(x + y)\nz <- y\nw <- z', type: IncrementalUpdateType.AddedAtEnd, applied: true },
			{ code: 'x <- 1\ny <- 5\nprint(x + y)\nz <- y\nw <- z', type: IncrementalUpdateType.ChangedAtEnd, applied: false },
			{ code: 'x <- 1\n\ny <- 5\nprint(x + y)\nz <- y\nw <- z', type: IncrementalUpdateType.Location, applied: true }
		), { mode: 'reuse', heuristic: adaptive() });
		assertIncrementalSequence('keeps no checkpoint for a change of the first statement', singleFileSteps(base,
			{ code: 'x <- 2\ny <- 2\nprint(x + y)', applied: false },
			{ code: 'x <- 3\ny <- 2\nprint(x + y)', applied: false },
			{ code: 'x <- 3\ny <- 2\nprint(x + y)\nz <- x', type: IncrementalUpdateType.AddedAtEnd, applied: false },
			{ code: 'x <- 3\ny <- 2\nprint(x + y)\nz <- y', applied: true }
		), { mode: 'reuse', heuristic: adaptive() });
		assertIncrementalSequence('resumes without reuse', singleFileSteps(base,
			{ code: `${base}\nz <- x`, applied: false },
			{ code: `${base}\nz <- x\nw <- z`, type: IncrementalUpdateType.AddedAtEnd, applied: true },
			{ code: `${base}\nz <- x\nw <- z`, type: IncrementalUpdateType.Nothing, applied: true }
		), { mode: 'resume', heuristic: adaptive() });
		assertIncrementalSequence('continues after a file added at the end', [
			{ files: { 'a.R': 'x <- 1', 'b.R': 'y <- x' } },
			{ files: { 'a.R': 'x <- 1', 'b.R': 'y <- x', 'c.R': 'print(y)' }, type: IncrementalUpdateType.NewFileAtEnd, applied: false },
			{ files: { 'a.R': 'x <- 1', 'b.R': 'y <- x', 'c.R': 'print(y)', 'd.R': 'z <- y' }, type: IncrementalUpdateType.NewFileAtEnd, applied: true },
			{ files: { 'a.R': 'x <- 2', 'b.R': 'y <- x', 'c.R': 'print(y)', 'd.R': 'z <- y' }, applied: false },
			{ files: { 'a.R': 'x <- 2', 'b.R': 'y <- x', 'c.R': 'print(y)', 'd.R': 'z <- y', 'e.R': 'z' }, type: IncrementalUpdateType.NewFileAtEnd, applied: false }
		], { mode: 'reuse', heuristic: adaptive(), allRequested: true });
		for(let seed = 0; seed < 10; seed++) {
			assertIncrementalSequence(`seed ${seed}`, fuzzedSequence(`incremental-adaptive-${seed}`, 6, 14), { mode: 'reuse', heuristic: adaptive() });
			assertIncrementalSequence(`seed ${seed} without reuse`, fuzzedSequence(`incremental-adaptive-resume-${seed}`, 6, 14), { mode: 'resume', heuristic: adaptive() });
		}
	});
	describe('exchangeable', () => {
		assertIncrementalSequence('a heuristic of its own decides', singleFileSteps(base,
			{ code: base, applied: false },
			{ code: `${base}\nz <- x`, applied: false }
		), { heuristic: new NeverIncremental() });
		test('at most one heuristic', async() => {
			const builder = new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor())
				.registerPlugins(new NeverIncremental(), new AdaptiveFlowrAnalyzerIncrementalDataflowHeuristicPlugin());
			let failed = false;
			try {
				await builder.build();
			} catch{
				failed = true;
			}
			assert.isTrue(failed, 'two heuristics must be rejected');
		});
	});
});
