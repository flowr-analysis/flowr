/**
 * The goal of this module is simply to streamline the creation of new scripts.
 *
 * @module
 */
import { scripts } from './scripts-info'
import commandLineUsage from 'command-line-usage'

// TODO: document
export function helpForOptions(name: keyof typeof scripts, content: {
	subtitle: string,
	examples: string[],
}): string {
	return commandLineUsage([
		{
			header:  scripts[name].description,
			content: content.subtitle
		},
		{
			header:  'Synopsis',
			content: content.examples.map(e => `$ ${scripts[name].toolName} ${e}`)
		},
		{
			header:     'Options',
			optionList: scripts[name].options
		}
	])
}


