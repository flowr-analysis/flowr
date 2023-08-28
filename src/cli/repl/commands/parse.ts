import { ReplCommand } from './main'
import { RShell } from '../../../r-bridge'
import { version } from '../../../../package.json'



export const parseCommand: ReplCommand = {
	description:  'Prints ASCII Art of the parsed, unmodified AST (uses the slicer-script api). Start with \'file://\' to indicate a file path',
	usageExample: ':parse',
	script:       false,
	fn:           shell => {

	}
}
