import { SemVer } from 'semver';
import { FlowrAnalyzerPlugin, PluginType } from '../../flowr-analyzer-plugin';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import { type IncrementalUpdateResult, IncrementalUpdate, IncrementalUpdateType } from './flowr-analyzer-incremental-dataflow-update-type-plugin';

/** How a dataflow analysis builds on the one before, see {@link FlowrAnalyzerIncrementalDataflowHeuristicPlugin}. */
export interface IncrementalDataflowPlan {
	/** hand out the analysis before again if only comments changed, see `incremental.dataflow.reuse` */
	readonly reuse:         boolean;
	/** after how many of the last top-level statements to keep a checkpoint to resume from, `0` resumes nothing, see `incremental.dataflow.checkpoints` */
	readonly checkpoints:   number;
	/** the number of top-level statements the checkpoints end at, so that a change after them resumes; the end of the file by default */
	readonly after?:        number;
	/** keep checkpoints only for files with at least this many top-level statements, see `incremental.dataflow.minStatements` */
	readonly minStatements: number;
}

/** What a {@link FlowrAnalyzerIncrementalDataflowHeuristicPlugin} decides on. */
export interface IncrementalDataflowHeuristicInformation {
	/** how many dataflow analyses the context ran before this one */
	readonly analyses:   number;
	/** how the analysis before classified its change, and whether it reused anything */
	readonly lastUpdate: IncrementalUpdateResult | undefined;
	/** how the files of this analysis differ from those of the analysis before, if that kept them */
	readonly update:     IncrementalUpdateResult | undefined;
}

/**
 * Base class for plugins that plan how a dataflow analysis builds on the one before, see {@link IncrementalDataflowPlan}.
 * At most one may be registered, {@link AdaptiveFlowrAnalyzerIncrementalDataflowHeuristicPlugin} runs otherwise.
 */
export abstract class FlowrAnalyzerIncrementalDataflowHeuristicPlugin extends FlowrAnalyzerPlugin<IncrementalDataflowHeuristicInformation, IncrementalDataflowPlan> {
	readonly type = PluginType.IncrementalDataflowHeuristic;

	public static override defaultPlugin(): FlowrAnalyzerIncrementalDataflowHeuristicPlugin {
		return new AdaptiveFlowrAnalyzerIncrementalDataflowHeuristicPlugin();
	}
}

/** Plans as {@link FlowrConfig.incremental.dataflow} states, checkpoints only if `activated`. */
export class ConfiguredFlowrAnalyzerIncrementalDataflowHeuristicPlugin extends FlowrAnalyzerIncrementalDataflowHeuristicPlugin {
	public readonly name = 'configured-incremental-dataflow-heuristic-plugin';
	public readonly description = 'Plans the incremental dataflow analysis as the incremental.dataflow configuration states.';
	public readonly version = new SemVer('0.1.0');

	protected process(ctx: FlowrAnalyzerContext): IncrementalDataflowPlan {
		const { reuse, activated, checkpoints, minStatements } = ctx.config.incremental.dataflow;
		return { reuse, checkpoints: activated ? checkpoints : 0, minStatements };
	}
}

/**
 * With `activated`, resumes only once a context analyzes its files again, as an editor or a watch does, and where it pays:
 * the first analysis keeps no checkpoint, so an analysis that stays the only one costs nothing.
 * Every later one keeps a single checkpoint, after the statements its change left as they were, as the next change likely happens where this one did.
 * So changing a statement again resumes right before it, however far from the end of the file it is, at the cost of one copy of the analysis up to there,
 * and a change that leaves nothing to resume from (e.g., of the first statement, or of one of multiple files) keeps no checkpoint at all.
 */
export class AdaptiveFlowrAnalyzerIncrementalDataflowHeuristicPlugin extends FlowrAnalyzerIncrementalDataflowHeuristicPlugin {
	public readonly name = 'adaptive-incremental-dataflow-heuristic-plugin';
	public readonly description = 'Keeps a checkpoint for the incremental dataflow analysis only once the files are analyzed again, where the last change happened.';
	public readonly version = new SemVer('0.2.0');

	protected process(ctx: FlowrAnalyzerContext, { analyses, update }: IncrementalDataflowHeuristicInformation): IncrementalDataflowPlan {
		const { reuse, activated, checkpoints, minStatements } = ctx.config.incremental.dataflow;
		return { reuse, checkpoints: activated && analyses > 0 && mayResumeAfter(update) ? Math.min(checkpoints, 1) : 0, after: update?.commonPrefix, minStatements };
	}
}

/** Whether an analysis may resume after a change like `update`: one that kept part of the analysis before, or an unknown one. */
function mayResumeAfter(update: IncrementalUpdateResult | undefined): boolean {
	return update === undefined || update.commonPrefix !== undefined || IncrementalUpdate.unchanged(update) || IncrementalUpdate.is(update, IncrementalUpdateType.NewFileAtEnd);
}
