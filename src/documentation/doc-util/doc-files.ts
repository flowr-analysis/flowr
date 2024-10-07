import fs from 'fs';

export const FlowrGithubBaseRef = 'https://github.com/flowr-analysis';
export const RemoteFlowrFilePathBaseRef = `${FlowrGithubBaseRef}/flowr/tree/main/`;
export const FlowrWikiBaseRef = `${FlowrGithubBaseRef}/flowr/wiki/`;
export const FlowrNpmRef = 'https://www.npmjs.com/package/@eagleoutice/flowr';

export function getFilePathMd(path: string): string {
	// we go one up as we are in doc-util now :D #convenience
	const fullpath = require.resolve('../' + path);
	const relative = fullpath.replace(process.cwd(), '.');
	/* remove project prefix */
	return `[\`${relative}\`](${RemoteFlowrFilePathBaseRef}${relative})`;
}

export function getFileContentFromRoot(path: string): string {
	const fullpath = require.resolve('../../../' + path);
	return fs.readFileSync(fullpath, 'utf-8');
}
