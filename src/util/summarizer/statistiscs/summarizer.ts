import { CommonSummarizerConfiguration, Summarizer } from '../summarizer'

// TODO: histograms
export interface StatisticsSummarizerConfiguration extends CommonSummarizerConfiguration {
	/**
	 * The input path to read from
	 */
	inputPath:              string
	/**
	 * Path for the intermediate results of the preparation phase
	 */
	intermediateOutputPath: string
	/**
	 * Path for the final results of the summarization phase
	 */
	outputLogPath?:         string
	/**
	 * Path for the final results of the summarization phase
	 */
	outputPath:             string
}

export class StatisticsSummarizer extends Summarizer<unknown, StatisticsSummarizerConfiguration> {
	public constructor(config: StatisticsSummarizerConfiguration) {
		super(config)
	}

	public preparationPhase(): Promise<void> {
		return Promise.resolve()
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- just to obey the structure
	public async summarizePhase(): Promise<unknown> {
		return Promise.resolve(undefined)
	}
}
