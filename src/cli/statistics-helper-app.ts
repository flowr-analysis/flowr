import { processCommandLineArgs } from './common/script';
import { getStatsForSingleFile } from './script-core/statistics-helper-core';

// apps should never depend on other apps when forking (otherwise, they are "run" whenever their root-files are loaded!)

export interface StatsHelperCliOptions {
	readonly verbose:      boolean
	readonly help:         boolean
	readonly input:        string
	readonly compress:     boolean
	readonly 'dump-json':  boolean
	readonly 'output-dir': string
	readonly 'root-dir':   string
	readonly 'no-ansi':    boolean
	readonly features:     string[]
}

const scriptOptions = processCommandLineArgs<StatsHelperCliOptions>('stats-helper', [],{
	subtitle: 'Given a single input file, this will collect usage statistics for the given features and write them to a file',
	examples: [
		'{bold -i} {italic example.R} {bold -i} {italic example2.R} {bold --output-dir} {italic "output-folder/"}',
		'{bold --help}'
	]
});

void getStatsForSingleFile(scriptOptions);
