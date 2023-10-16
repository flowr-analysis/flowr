import { CommonSummarizerConfiguration, Summarizer } from '../summarizer'
import { getAllFiles } from '../../files'

// TODO: histograms
export interface StatisticsSummarizerConfiguration extends CommonSummarizerConfiguration {
	/**
	 * The input path to read all zips from
	 */
	inputPath:     string
	/**
	 * Features to extract the summaries for
	 */
	featuresToUse: Set<string>
	/**
	 * Path for the final results of the summarization phase
	 */
	outputPath:    string
}

export class StatisticsSummarizer extends Summarizer<unknown, StatisticsSummarizerConfiguration> {
	public constructor(config: StatisticsSummarizerConfiguration) {
		super(config)
	}

	public async preparationPhase(): Promise<void> {
		for await (const f of getAllFiles(this.config.inputPath, /\.tar.gz$/)) {
			console.log(f)
		}
		return Promise.resolve()
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- just to obey the structure
	public async summarizePhase(): Promise<unknown> {
		return Promise.resolve(undefined)
	}
}
