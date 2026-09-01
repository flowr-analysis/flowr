import type { SummarizerCliOptions } from '../summarizer-app';
import { BenchmarkSummarizer } from '../../benchmark/summarizer/summarizer';


function getBenchmarkSummarizer(options: SummarizerCliOptions, outputBase: string) {
	return new BenchmarkSummarizer({
		graphOutputPath:        options.graph ? `${outputBase}-graph.json` : undefined,
		inputPath:              options.input,
		intermediateOutputPath: outputBase,
		outputPath:             `${outputBase}-ultimate.json`,
		logger:                 console.log
	});
}

/**
 * The core function for the 'flowr summarize' script.
 */
export async function flowrScriptSummarizer(options: SummarizerCliOptions) {
	if(options.type && options.type !== 'benchmark') {
		console.error(`Warning: --type ${options.type} is no longer supported. The summarizer only produces benchmark summaries.`);
	}
	if(options.categorize) {
		console.error('Warning: --categorize is no longer supported.');
	}
	if(options['project-skip'] && options['project-skip'] > 0) {
		console.error(`Warning: --project-skip ${options['project-skip']} is no longer supported.`);
	}

	const outputBase = (options.output ?? options.input).replace(/\.json$|\/$/, '-summary');
	console.log(`Writing outputs to base ${outputBase}`);

	const summarizer = getBenchmarkSummarizer(options, outputBase);

	if(!options['ultimate-only']) {
		await summarizer.preparationPhase();
	}

	await summarizer.summarizePhase();
}
