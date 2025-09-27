import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';


import { autoGenHeader } from './doc-util/doc-auto-gen';
import { getTypesFromFolder, mermaidHide, shortLink } from './doc-util/doc-types';
import path from 'path';
import { FlowrAnalyzer } from '../project/flowr-analyzer';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';

	const types = getTypesFromFolder({
		rootFolder:  path.resolve('src/'),
		inlineTypes: mermaidHide
	});

	return `${autoGenHeader({ filename: module.filename, purpose: 'analyzer', rVersion: rversion })}

We are currently working on documenting the capabilities of the analyzer (with the plugins, their loading order, etc.). In general, the code documentation
starting with the ${shortLink(FlowrAnalyzer.name, types.info)} and the ${shortLink(FlowrAnalyzerBuilder.name, types.info)} 
should be the best starting point.
`;
}

/** if we run this script, we want a Markdown representation of the capabilities */
if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);

	const shell = new RShell();
	void getText(shell).then(str => {
		console.log(str);
	}).finally(() => {
		shell.close();
	});
}
