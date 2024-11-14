import fs from 'fs';

export const FlowrGithubBaseRef = 'https://github.com/flowr-analysis';
export const FlowrSiteBaseRef = 'https://flowr-analysis.github.io/flowr';
export const RemoteFlowrFilePathBaseRef = `${FlowrGithubBaseRef}/flowr/tree/main/`;
export const FlowrWikiBaseRef = `${FlowrGithubBaseRef}/flowr/wiki/`;
export const FlowrNpmRef = 'https://www.npmjs.com/package/@eagleoutice/flowr';
export const FlowrDockerRef = 'https://hub.docker.com/r/eagleoutice/flowr';
export const FlowrCodecovRef = 'https://app.codecov.io/gh/flowr-analysis/flowr';

export function getFilePathMd(path: string): string {
	// we go one up as we are in doc-util now :D #convenience
	const fullpath = require.resolve('../' + path);
	// normalize path separators so that this is consistent when testing on windows
	const cwd = process.cwd().replaceAll('\\', '/');
	const relative = fullpath.replaceAll('\\', '/').replace(cwd, '.');
	/* remove project prefix */
	return `[\`${relative}\`](${RemoteFlowrFilePathBaseRef}${relative})`;
}

export function getFileContentFromRoot(path: string): string {
	const fullpath = require.resolve('../../../' + path);
	return fs.readFileSync(fullpath, 'utf-8');
}
