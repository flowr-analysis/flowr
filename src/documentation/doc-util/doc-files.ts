import fs from 'fs';
import path from 'path';
import { toPosixPath } from '../../util/files';

export const FlowrGithubGroupName = 'flowr-analysis';
export const FlowrGithubBaseRef = `https://github.com/${FlowrGithubGroupName}`;
export const FlowrSiteBaseRef = `https://${FlowrGithubGroupName}.github.io/flowr`;
export const RemoteFlowrFilePathBaseRef = `${FlowrGithubBaseRef}/flowr/tree/main/`;
export const FlowrWikiBaseRef = `${FlowrGithubBaseRef}/flowr/wiki`;
export const FlowrGithubRef = FlowrGithubBaseRef + '/flowr';
export const FlowrNpmRef = 'https://www.npmjs.com/package/@eagleoutice/flowr';
export const FlowrDockerRef = 'https://hub.docker.com/r/eagleoutice/flowr';
export const FlowrCodecovRef = `https://app.codecov.io/gh/${FlowrGithubGroupName}/flowr`;
export const FlowrVsCode = 'https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr';
export const FlowrPositron = 'https://open-vsx.org/extension/code-inspect/vscode-flowr';
export const FlowrRStudioAddin = `${FlowrGithubBaseRef}/rstudio-addin-flowr`;
export const FlowrRAdapter = `${FlowrGithubBaseRef}/flowr-r-adapter`;

export { toPosixPath };

/**
 * Returns a markdown link to the given file path relative to the project root.
 */
export function getFilePathMd(filePath: string): string {
	// we go one up as we are in doc-util now :D #convenience
	const fullpath = require.resolve('../' + filePath);
	const relative = './' + toPosixPath(path.relative(process.cwd(), fullpath));
	return `[\`${relative}\`](${RemoteFlowrFilePathBaseRef}${relative})`;
}

/**
 * Returns the content of a file located at the given path relative to the project root.
 * This reads the file synchronously from disk.
 */
export function getFileContentFromRoot(path: string): string {
	const fullpath = require.resolve('../../../' + path);
	return fs.readFileSync(fullpath, 'utf-8');
}

/**
 * Returns a markdown link to the given flowr source file path.
 */
export function linkFlowRSourceFile(path: string): string {
	return `[${path}](${RemoteFlowrFilePathBaseRef}/${path})`;
}
