import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { FlowrWikiBaseRef } from './doc-util/doc-files';


import { autoGenHeader } from './doc-util/doc-auto-gen';

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	return `${autoGenHeader({ filename: module.filename, purpose: 'search API', rVersion: rversion })}

This page briefly summarizes flowR's search API, TODO.
Please see the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more information on how to access this API.

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
