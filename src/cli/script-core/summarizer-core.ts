import type { SummarizerCliOptions } from '../summarizer-app';
import { StatisticsSummarizer } from '../../statistics/summarizer/summarizer';
import { BenchmarkSummarizer } from '../../benchmark/summarizer/summarizer';
import { detectSummarizationType } from '../../statistics/summarizer/auto-detect';
import { SummarizerType } from '../../util/summarizer';
import { allFeatureNames } from '../../statistics/features/feature';


function getBenchmarkSummarizer(options: SummarizerCliOptions, outputBase: string) {
	return new BenchmarkSummarizer({
		graphOutputPath:        options.graph ? `${outputBase}-graph.json` : undefined,
		inputPath:              options.input,
		intermediateOutputPath: outputBase,
		outputPath:             `${outputBase}-ultimate.json`,
		logger:                 console.log
	});
}

function getStatisticsSummarizer(options: SummarizerCliOptions, outputBase: string) {
	return new StatisticsSummarizer({
		inputPath:              options.input,
		outputPath:             `${outputBase}-final`,
		intermediateOutputPath: `${outputBase}-intermediate/`,
		projectSkip:            options['project-skip'],
		featuresToUse:          allFeatureNames,
		logger:                 console.log
	});
}


async function retrieveSummarizer(options: SummarizerCliOptions, outputBase: string): Promise<StatisticsSummarizer | BenchmarkSummarizer> {
	const type = options.type === 'auto' ? await detectSummarizationType(options.input) : options.type;
	if(type === SummarizerType.Benchmark) {
		console.log('Summarizing benchmark');
		return getBenchmarkSummarizer(options, outputBase);
	} else if(type === SummarizerType.Statistics) {
		console.log('Summarizing statistics');
		return getStatisticsSummarizer(options, outputBase);
	} else {
		console.error('Unknown type', type, 'either give "benchmark" or "statistics"');
		process.exit(1);
	}
}

export async function flowrScriptSummarizer(options: SummarizerCliOptions) {
	const outputBase = (options.output ?? options.input).replace(/\.json$|\/$/, '-summary');
	console.log(`Writing outputs to base ${outputBase}`);

	const summarizer = await retrieveSummarizer(options, outputBase);

	if(!options['ultimate-only']) {
		await summarizer.preparationPhase(options.categorize);
	}

	await summarizer.summarizePhase();
}
