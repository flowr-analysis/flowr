import type { ReplCommand, ReplOutput } from './repl-main';
import type { KnownParser } from '../../../r-bridge/parser';
import { flowrVersion } from '../../../util/version';
import { guard } from '../../../util/assert';

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

export async function retrieveVersionInformation(parser: KnownParser): Promise<VersionInformation> {
	const flowr = flowrVersion().toString();
	const r = await parser.rVersion();

	guard(versionRegex.test(flowr), `flowR version ${flowr} does not match the expected format!`);
	guard(r === 'unknown' || r === 'none' || versionRegex.test(r), `R version ${r} does not match the expected format!`);

	return { flowr: flowr as Version, r: r as Version, engine: parser.name };
}

export async function printVersionInformation(output: ReplOutput, parser: KnownParser) {
	const { flowr, r, engine } = await retrieveVersionInformation(parser);
	output.stdout(`Engine: ${engine}`);
	output.stdout(` flowR: ${flowr}`);
	output.stdout(` R: ${r}`);
}

export const versionCommand: ReplCommand = {
	description:  'Prints the version of flowR as well as the current version of R',
	aliases:      [],
	usageExample: ':version',
	script:       false,
	fn:           (output, parser) => printVersionInformation(output, parser)
};
