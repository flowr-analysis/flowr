import { SemVer } from 'semver';
import type { KnownParser } from '../r-bridge/parser';
import { guard } from './assert';
import type { ReplOutput } from '../cli/repl/commands/repl-main';
import type { FlowrAnalysisProvider } from '../project/flowr-analyzer';

// this is automatically replaced with the current version by release-it
const version = '2.6.0';

export function flowrVersion(): SemVer {
	return new SemVer(version);
}

type Version = `${number}.${number}.${number}`

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

export async function retrieveVersionInformation(input: KnownParser | FlowrAnalysisProvider): Promise<VersionInformation> {
	const flowr = flowrVersion().toString();

	let r: string;
	let name: string;
	if('name' in input) {
		r = await input.rVersion();
		name = input.name;
	} else {
		const parserInformation = await input.parserInformation();
		r = parserInformation.name === 'r-shell' ? parserInformation.rVersion : 'unknown';
		name = parserInformation.name;
	}

	guard(versionRegex.test(flowr), `flowR version ${flowr} does not match the expected format!`);
	guard(r === 'unknown' || r === 'none' || versionRegex.test(r), `R version ${r} does not match the expected format!`);

	return { flowr: flowr as Version, r: r as Version, engine: name };
}

export async function printVersionInformation(output: ReplOutput, input: KnownParser | FlowrAnalysisProvider) {
	const { flowr, r, engine } = await retrieveVersionInformation(input);
	output.stdout(`Engine: ${engine}`);
	output.stdout(` flowR: ${flowr}`);
	output.stdout(` R: ${r}`);
}
