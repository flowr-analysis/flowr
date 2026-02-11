import { SemVer } from 'semver';
import type { KnownParser } from '../r-bridge/parser';
import { guard } from './assert';
import type { ReplOutput } from '../cli/repl/commands/repl-main';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';

// this is automatically replaced with the current version by release-it
const version = '2.9.9';

/**
 * Retrieves the current flowR version as a new {@link SemVer} object.
 */
export function flowrVersion(): SemVer {
	return new SemVer(version);
}

type Version = `${number}.${number}.${number}`;

/**
 * Describes the version of flowR and the used R interpreter.
 */
export interface VersionInformation {
	/** The version of flowR */
	flowr:  Version,
	/** The version of R identified by the underlying {@link RShell} */
	r:      Version | 'unknown' | 'none',
	engine: string
}

const versionRegex = /^\d+\.\d+\.\d+/m;


/**
 * Retrieves the version information for flowR and the given parser or analysis provider.
 */
export async function retrieveVersionInformation(input: KnownParser | ReadonlyFlowrAnalysisProvider): Promise<VersionInformation> {
	const flowr = flowrVersion().toString();

	let r: string;
	let name: string;
	if('name' in input) {
		r = await input.rVersion();
		name = input.name;
	} else {
		const parserInformation = input.parserInformation();
		r = parserInformation.name === 'r-shell' ? (await parserInformation.rVersion()) : 'unknown';
		name = parserInformation.name;
	}

	guard(versionRegex.test(flowr), `flowR version ${flowr} does not match the expected format!`);
	guard(r === 'unknown' || r === 'none' || versionRegex.test(r), `R version ${r} does not match the expected format!`);

	return { flowr: flowr as Version, r: r as Version, engine: name };
}


/**
 * Displays the version information to the given output.
 */
export async function printVersionInformation(output: ReplOutput, input: KnownParser | ReadonlyFlowrAnalysisProvider) {
	const { flowr, r, engine } = await retrieveVersionInformation(input);
	output.stdout(`Engine: ${engine}`);
	output.stdout(` flowR: ${flowr}`);
	output.stdout(` R: ${r}`);
}
