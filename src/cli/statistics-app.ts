import { log } from '../util/log';
import { setFormatter, voidFormatter } from '../util/ansi';
import { processCommandLineArgs } from './common/script';
import {flowrScriptGetStats} from "./script-core/statistics-core";

export interface StatsCliOptions {
	readonly verbose:      boolean
	readonly help:         boolean
	readonly limit:        number | undefined
	readonly input:        string[]
	readonly 'dump-json':  boolean
	readonly 'output-dir': string
	readonly 'no-ansi':    boolean
	/* if parallel is 0, we do not launch the executor but instead directly call the underlying function, which makes it suitable for testing */
	readonly parallel:     number
	readonly features:     string[]
}

const scriptOptions = processCommandLineArgs<StatsCliOptions>('stats', [],{
	subtitle: 'Given input files or folders, this will collect usage statistics for the given features and write them to a file',
	examples: [
		'{bold -i} {italic example.R} {bold -i} {italic example2.R} {bold --output-dir} {italic "output-folder/"}',
		'{italic "folder1/"} {bold --features} {italic all} {bold --output-dir} {italic "output-folder/"}',
		'{bold --post-process} {italic "output-folder"} {bold --features} {italic assignments}',
		'{bold --help}'
	]
});

void flowrScriptGetStats(scriptOptions);
