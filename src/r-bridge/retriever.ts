import { type RShell } from './shell'
import type { XmlParserHooks, NormalizedAst } from './lang-4.x'
import { ts2r } from './lang-4.x'
import { startAndEndsWith } from '../util/strings'
import type {AsyncOrSync, DeepPartial} from 'ts-essentials'
import { guard } from '../util/assert'
import {RShellExecutor} from './shell-executor'
import objectHash from 'object-hash'
import {normalize} from './lang-4.x/ast/parser/csv/parser'

export interface RParseRequestFromFile {
	request: 'file';
	/** The path to the file (absolute paths are probably best here */
	content: string;
}

export interface RParseRequestFromText {
	request: 'text'
	/* Source code to parse (not a file path) */
	content: string
}

interface RParseRequestBase {
	/**
   * Ensure that all required packages are present and if not install them?
   * The only reason to set this to `false` is probably in a series of parse requests for the same session.
   */
	ensurePackageInstalled: boolean
}

/**
 * A provider for an {@link RParseRequest} that can be used, for example, to override source file parsing behavior in tests
 */
export interface RParseRequestProvider {
	createRequest(path: string): RParseRequest
}

/**
 * A request that can be passed along to {@link retrieveCsvFromRCode}.
 */
export type RParseRequest = (RParseRequestFromFile | RParseRequestFromText) & RParseRequestBase

export function requestFromInput(input: `file://${string}`): RParseRequestFromFile & RParseRequestBase
export function requestFromInput(input: string): RParseRequestFromText & RParseRequestBase

/**
 * Creates a {@link RParseRequest} from a given input.
 */
export function requestFromInput(input: `file://${string}` | string): RParseRequest {
	const file = input.startsWith('file://')
	return {
		request:                file ? 'file' : 'text',
		content:                file ? input.slice(7) : input,
		ensurePackageInstalled: false // should be called within describeSession for that!
	}
}

export function requestProviderFromFile(): RParseRequestProvider {
	return {
		createRequest(path: string): RParseRequest {
			return {
				request:                'file',
				content:                path,
				ensurePackageInstalled: false}
		}
	}
}

export function requestProviderFromText(text: {[path: string]: string}): RParseRequestProvider{
	return {
		createRequest(path: string): RParseRequest {
			return {
				request:                'text',
				content:                text[path],
				ensurePackageInstalled: false
			}
		}
	}
}

export function requestFingerprint(request: RParseRequest): string {
	return objectHash(request)
}

const ErrorMarker = 'err'

/**
 * Provides the capability to parse R files/R code using the R parser.
 * Depends on {@link RShell} to provide a connection to R.
 * <p>
 * Throws if the file could not be parsed.
 * If successful, allows to further query the last result with {@link retrieveNumberOfRTokensOfLastParse}.
 */
export function retrieveCsvFromRCode(request: RParseRequest, shell: (RShell | RShellExecutor)): AsyncOrSync<string> {
	const suffix = request.request === 'file' ? ', encoding="utf-8"' : ''
	const setupCommands = [
		`flowr_output <- flowr_parsed <- "${ErrorMarker}"`,
		`try(flowr_parsed<-parse(${request.request}=${JSON.stringify(request.content)},keep.source=TRUE${suffix}),silent=FALSE)`,
		'try(flowr_output<-write.table(getParseData(flowr_parsed),sep=",",col.names=TRUE,qmethod="d"))',
	]
	const outputCommand = `cat(flowr_output,${ts2r(shell.options.eol)})`

	if(shell instanceof RShellExecutor){
		shell.addPrerequisites(setupCommands)
		return guardRetrievedOutput(shell.run(outputCommand), request)
	} else {
		const run = async() => {
			shell.sendCommands(...setupCommands)
			return guardRetrievedOutput((await shell.sendCommandWithOutput(outputCommand)).join(shell.options.eol), request)
		}
		return run()
	}
}

/**
 * Uses {@link retrieveCsvFromRCode} and returns the nicely formatted object-AST.
 * If successful, allows to further query the last result with {@link retrieveNumberOfRTokensOfLastParse}.
 */
export async function retrieveNormalizedAstFromRCode(request: RParseRequest, shell: RShell, hooks?: DeepPartial<XmlParserHooks>): Promise<NormalizedAst> {
	const csv = await retrieveCsvFromRCode(request, shell)
	return normalize(csv, hooks)
}

/**
 * If the string has (R-)quotes around it, they will be removed, otherwise the string is returned unchanged.
 */
export function removeTokenMapQuotationMarks(str: string): string {
	if(str.length > 1 && (startAndEndsWith(str, '\'') || startAndEndsWith(str, '"'))) {
		return str.slice(1, -1)
	} else {
		return str
	}
}

/**
 * Needs to be called *after*  {@link retrieveCsvFromRCode} (or {@link retrieveNormalizedAstFromRCode})
 */
export async function retrieveNumberOfRTokensOfLastParse(shell: RShell): Promise<number> {
	const result = await shell.sendCommandWithOutput(`cat(nrow(getParseData(flowr_parsed)),${ts2r(shell.options.eol)})`)
	guard(result.length === 1, () => `expected exactly one line to obtain the number of R tokens, but got: ${JSON.stringify(result)}`)
	return Number(result[0])
}

function guardRetrievedOutput(output: string,  request: RParseRequest): string {
	guard(output !== ErrorMarker, () => `unable to parse R code (see the log for more information) for request ${JSON.stringify(request)}}`)

	// we add a dummy header to the first line because of weird behavior with the returned csv
	// example: line1 is mapped to 7, which is the same as the "id" column's entry
	// "line1","col1","line2","col2","id","parent","token","terminal","text"
	// "7",1,1,1,5,7,0,"expr",FALSE,""
	// (see https://github.com/Code-Inspect/flowr/issues/653)
	output = `"id2dummy",${output}`

	return output
}
