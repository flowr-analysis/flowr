import { MergeableRecord } from '../objects'

export const enum SummarizerType {
	Benchmark	 = 'benchmark',
	Statistics	 = 'statistics',
}


export interface CommonSummarizerConfiguration extends MergeableRecord{
	logger: (message: string) => void
}

export abstract class Summarizer<Output, Configuration extends CommonSummarizerConfiguration> {
	protected readonly config: Configuration
	protected readonly log:    CommonSummarizerConfiguration['logger']

	protected constructor(config: Configuration) {
		this.config = config
		this.log = this.config.logger
	}


	/**
	 * First phase of the summary, can be used to extract all data of interest from the individual
	 * benchmark or statistic results. This can write temporary files based on the configuration.
	 *
	 * @param useTypeClassification - Whether to split the analysis based on the detected type (e.g. 'test', 'example', ...)
	 */
	public abstract preparationPhase(useTypeClassification: boolean): Promise<void>

	/**
	 * Second phase of the summary, can be used to combine the data from the first phase
	 * and produce some kind of "ultimate results".
	 */
	public abstract summarizePhase(): Promise<Output>
}
