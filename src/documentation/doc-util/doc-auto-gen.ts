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
	return `_This document was generated automatically from '${filename}' on ${currentDateAndTime} presenting an overview of flowR's ${purpose} (version: ${flowrVersion().format()}${ rVersion ? ', using R version ' + rVersion : ''})._`;
}
