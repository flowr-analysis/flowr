import { flowrVersion } from '../../util/version';

export interface AutoGenHeaderArguments {
    readonly rVersion?:           string;
    readonly currentDateAndTime?: string;
    readonly filename:            string;
    readonly purpose:             string;
}
export function autoGenHeader(
	{ rVersion, filename, purpose, currentDateAndTime = new Date().toISOString().replace('T', ', ').replace(/\.\d+Z$/, ' UTC') }: AutoGenHeaderArguments
) {
	const shortenFilename = filename.replace(/^.*src\//, 'src/');
	return `_This document was generated from '${shortenFilename}' on ${currentDateAndTime} presenting an overview of flowR's ${purpose} (v${flowrVersion().format()}${ rVersion ? ', using R v' + rVersion : ''})._`;
}
