/**
 * The summarizer intends to post-process and summarize the results of
 * the benchmark tool, and
 * the statistics extraction.
 * @module
 */

import { processCommandLineArgs } from './common/script';
import { flowrScriptSummarizer } from './script-core/summarizer-core';

export interface SummarizerCliOptions {
	verbose:         boolean
	help:            boolean
	'ultimate-only': boolean
	categorize:      boolean
	input:           string
	type:            string
	output?:         string
	graph?:          boolean
	'project-skip':  number
}

const options = processCommandLineArgs<SummarizerCliOptions>('summarizer', ['input'], {
	subtitle: 'Summarize and explain the results of the benchmark tool. Summarizes in two stages: first per-request, and then overall',
	examples: [
		'{italic benchmark.json}',
		'{bold --help}'
	]
});

void flowrScriptSummarizer(options);
