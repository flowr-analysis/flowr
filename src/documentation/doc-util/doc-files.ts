import fs from 'fs';

export const RemoteFlowrFilePathBaseRef = 'https://github.com/flowr-analysis/flowr/tree/main/';
export const FlowrWikiBaseRef = 'https://github.com/flowr-analysis/flowr/wiki/';

export function getFilePathMd(path: string): string {
	// we go one up as we are in doc-util now :D #convenience
	const fullpath = require.resolve('../' + path);
	const relative = fullpath.replace(process.cwd(), '.');
	/* remove project prefix */
	return `[\`${relative}\`](${RemoteFlowrFilePathBaseRef}${relative})`;
}

export function getFileContent(path: string): string {
	return fs.readFileSync(require.resolve(path), 'utf-8');
}
