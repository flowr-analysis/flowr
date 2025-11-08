import fs from 'fs';

export const FlowrGithubGroupName = 'flowr-analysis';
export const FlowrGithubBaseRef = `https://github.com/${FlowrGithubGroupName}`;
export const FlowrSiteBaseRef = `https://${FlowrGithubGroupName}.github.io/flowr`;
export const RemoteFlowrFilePathBaseRef = `${FlowrGithubBaseRef}/flowr/tree/main/`;
export const FlowrWikiBaseRef = `${FlowrGithubBaseRef}/flowr/wiki`;
export const FlowrNpmRef = 'https://www.npmjs.com/package/@eagleoutice/flowr';
export const FlowrDockerRef = 'https://hub.docker.com/r/eagleoutice/flowr';
export const FlowrCodecovRef = `https://app.codecov.io/gh/${FlowrGithubGroupName}/flowr`;
export const FlowrVsCode = 'https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr';
export const FlowrPositron = 'https://open-vsx.org/extension/code-inspect/vscode-flowr';

/**
 *
 */
export function getFilePathMd(path: string): string {
	// we go one up as we are in doc-util now :D #convenience
	const fullpath = require.resolve('../' + path);
	// normalize path separators so that this is consistent when testing on windows
	const cwd = process.cwd().replaceAll('\\', '/');
	const relative = fullpath.replaceAll('\\', '/').replace(cwd, '.');
	/* remove project prefix */
	return `[\`${relative}\`](${RemoteFlowrFilePathBaseRef}${relative})`;
}

/**
 *
 */
export function getFileContentFromRoot(path: string): string {
	const fullpath = require.resolve('../../../' + path);
	return fs.readFileSync(fullpath, 'utf-8');
}

/**
 *
 */
export function linkFlowRSourceFile(path: string): string {
	return `[${path}](${RemoteFlowrFilePathBaseRef}/${path})`;
}
