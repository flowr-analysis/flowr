import { type OutputFormatter , formatter } from '../../../util/text/ansi';
import type { FlowrAnalysisProvider, ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';

/**
 * Defines the main interface for output of the repl.
 * This allows us to redirect it (e.g., in the case of a server connection or tests).
 *
 * The formatter allows to dynamically change the use of ansi escape sequences (see {@link OutputFormatter})
 * @see standardReplOutput
 */
export interface ReplOutput {
	formatter: OutputFormatter
	stdout(msg: string): void
	stderr(msg: string): void
}

/**
 * Default repl output that redirects everything to the stdout and stderror channels (linked to `console`).
 * @see ReplOutput
 */
export const standardReplOutput: ReplOutput = {
	formatter: formatter,
	stdout:    console.log,
	stderr:    console.error
};


/**
 * Information passed to each {@link ReplCommand#fn}.
 */
export interface ReplCommandInformation {
	output:              ReplOutput,
	allowRSessionAccess: boolean,
	analyzer:            ReadonlyFlowrAnalysisProvider,
	remainingLine:       string,
}


/**
 * Information passed to each {@link ReplCodeCommand#fn}.
 * The {@link analyzer} has the {@link RParseRequest}.
 */
export interface ReplCodeCommandInformation {
	output:        ReplOutput,
	analyzer:      FlowrAnalysisProvider
	remainingArgs: string[]
}

/**
 * Content of a single command in the repl.
 * The command may execute an external script or simply call *flowR* functions.
 */
export interface ReplBaseCommand {
	/** Aliases of the command (without the leading colon), every alias must be unique (this is checked at runtime) */
	aliases:      string[]
	/** A human-readable description of what the command does */
	description:  string
	/** Does the command invoke another script? this is mainly used to automatically generate two separate lists when asking for help */
	script:       boolean
	/** Example of how to use the command, for example `:slicer --help` */
	usageExample: string
}

export interface ReplCommand extends ReplBaseCommand {
	isCodeCommand: false;
	/**
	 * Function to execute when the command is invoked, it must not write to the command line but instead use the output handler.
	 * Furthermore, it has to obey the formatter defined in the {@link ReplOutput}.
	 */
	fn:            (info: ReplCommandInformation) => Promise<void> | void
}

/**
 * Result of parsing a REPL code command line.
 * `rCode` may be undefined, in which case the R code of a previous REPL command will be re-used.
 */
interface ParsedReplLine {
	rCode:     string | undefined;
	remaining: string[];
}

/**
 * Repl command that uses the {@link FlowrAnalyzer}
 */
export interface ReplCodeCommand extends ReplBaseCommand {
	isCodeCommand: true;
	/**
	 * Function to execute when the command is invoked, it must not write to the command line but instead use the output handler.
	 * Furthermore, it has to obey the formatter defined in the {@link ReplOutput}.
	 */
	fn:            (info: ReplCodeCommandInformation) => Promise<void> | void
	/**
	 * Argument parser function which handles the input given after the repl command.
	 * If no R code is returned, the input R code of a previous REPL command will be re-used for processing the current REPL command.
	 */
	argsParser:    (remainingLine: string) => ParsedReplLine
}
