import { RShell, TokenMap } from '../../../r-bridge'

/**
 * Content of a single command in the repl.
 */
export interface ReplCommand {
	/** aliases of the command (without the leading colon), must be unique */
	aliases:      string[]
	/** human-readable description of what the command does */
	description:  string
	/** does the command invoke another script? this is mainly used to automatically generate two separate lists when asking for help */
	script:       boolean
	/** example of how to use the command, for example `:slicer --help` */
	usageExample: string
	/** function to execute when the command is invoked */
	fn:           (shell: RShell, tokenMap: TokenMap, remainingLine: string) => Promise<void> | void
}
