import { withShell } from '../../../helper/shell'


describe('for', withShell(shell => {
	console.log('hello world', shell)
}))