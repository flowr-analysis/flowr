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

/**
 * A provider for an {@link RParseRequest} that can be used, for example, to override source file parsing behavior in tests
 */
export interface RParseRequestProvider {
	createRequest(path: string): RParseRequest
}

/**
 * A request that can be passed along to {@link retrieveParseDataFromRCode}.
 */
export type RParseRequest = (RParseRequestFromFile | RParseRequestFromText)

export function requestFromInput(input: `file://${string}`): RParseRequestFromFile
export function requestFromInput(input: string): RParseRequestFromText

/**
 * Creates a {@link RParseRequest} from a given input.
 */
export function requestFromInput(input: `file://${string}` | string): RParseRequest {
	const file = input.startsWith('file://')
	return {
		request: file ? 'file' : 'text',
		content: file ? input.slice(7) : input
	}
}

export function requestProviderFromFile(): RParseRequestProvider {
	return {
		createRequest(path: string): RParseRequest {
			return {
				request: 'file',
				content: path,
			}
		}
	}
}

export function requestProviderFromText(text: {[path: string]: string}): RParseRequestProvider{
	return {
		createRequest(path: string): RParseRequest {
			return {
				request: 'text',
				content: text[path]
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
export function retrieveParseDataFromRCode(request: RParseRequest, shell: (RShell | RShellExecutor)): AsyncOrSync<string> {
	const suffix = request.request === 'file' ? ', encoding="utf-8"' : ''
	const eol = ts2r(shell.options.eol)
	const command =
		'tryCatch({'
	+ `flowr_parsed<-parse(${request.request}=${JSON.stringify(request.content)},keep.source=TRUE${suffix});`
	+ 'flowr_output<-getParseData(flowr_parsed,includeText=TRUE);'
	+ `cat(paste0("[",paste0(apply(flowr_output,1,function(o) paste0("[",paste0(o$line1,o$col1,o$line2,o$col2,o$id,o$parent,o$token,o$terminal,o$text,collapse=","),"]",collapse="")),collapse=","),"]",collapse=""),${eol})`
	+ `}, error=function(e) { cat("${ErrorMarker}",${eol}) })`

	if(shell instanceof RShellExecutor){
		return guardRetrievedOutput(shell.run(command), request)
	} else {
		return shell.sendCommandWithOutput(command).then(result => {
			return guardRetrievedOutput(result.join(shell.options.eol), request)
		}).catch(e => {
			throw new Error(`unable to parse R code (see the log for more information) for request ${JSON.stringify(request)}: ${e}`)
		})
	}
}

/**
 * Uses {@link retrieveParseDataFromRCode} and returns the nicely formatted object-AST.
 * If successful, allows to further query the last result with {@link retrieveNumberOfRTokensOfLastParse}.
 */
export async function retrieveNormalizedAstFromRCode(request: RParseRequest, shell: RShell, hooks?: DeepPartial<XmlParserHooks>): Promise<NormalizedAst> {
	const data = await retrieveParseDataFromRCode(request, shell)
	return normalize(data, hooks)
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
 * Needs to be called *after*  {@link retrieveParseDataFromRCode} (or {@link retrieveNormalizedAstFromRCode})
 */
export async function retrieveNumberOfRTokensOfLastParse(shell: RShell): Promise<number> {
	const result = await shell.sendCommandWithOutput(`cat(nrow(flowr_output),${ts2r(shell.options.eol)})`)
	guard(result.length === 1, () => `expected exactly one line to obtain the number of R tokens, but got: ${JSON.stringify(result)}`)
	return Number(result[0])
}

function guardRetrievedOutput(output: string, request: RParseRequest): string {
	console.log(output)
	guard(output !== ErrorMarker,
		() => `unable to parse R code (see the log for more information) for request ${JSON.stringify(request)}}`)
	return output
}
