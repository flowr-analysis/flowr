import { type RShell } from "./shell"
import { parseCSV, ts2r, XmlParserHooks, RExpressionList, normalize } from './lang-4.x'
import { startAndEndsWith } from '../util/strings'
import { DeepPartial, DeepReadonly } from 'ts-essentials'
import { guard } from '../util/assert'

export interface RParseRequestFromFile {
	request: "file";
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
   * Should lexeme information be retained in the AST?
   * You most likely want `true` here.
   */
	attachSourceInformation: boolean
	/**
   * Ensure that all required packages are present and if not install them?
   * The only reason to set this to `false` is probably ina series of parse requests for the same session.
   */
	ensurePackageInstalled:  boolean
}

/**
 * A request that can be passed along to {@link retrieveXmlFromRCode}.
 */
export type RParseRequest = (RParseRequestFromFile | RParseRequestFromText) & RParseRequestBase

const ERR_MARKER = "err"

/**
 * Provides the capability to parse R files/R code using the R parser.
 * Depends on {@link RShell} to provide a connection to R.
 * <p>
 * Throws if the file could not be parsed.
 * If successful, allows to further query the last result with {@link retrieveNumberOfRTokensOfLastParse}.
 */
export async function retrieveXmlFromRCode(request: RParseRequest, shell: RShell): Promise<string> {
	if (request.ensurePackageInstalled) {
		await shell.ensurePackageInstalled('xmlparsedata', true)
	}

	const suffix = request.request === 'file' ? ', encoding="utf-8"' : ''

	shell.sendCommands(`flowr_output <- flowr_parsed <- "${ERR_MARKER}"`,
		// now, try to retrieve the ast
		`try(flowr_parsed <- parse(${request.request} = ${JSON.stringify(request.content)}, keep.source = ${ts2r(request.attachSourceInformation)}${suffix}), silent=FALSE)`,
		`try(flowr_output <- xmlparsedata::xml_parse_data(flowr_parsed, includeText = ${ts2r(request.attachSourceInformation)}, pretty = FALSE), silent=FALSE)`
	)
	const xml = await shell.sendCommandWithOutput(`cat(flowr_output,${ts2r(shell.options.eol)})`)
	const output = xml.join(shell.options.eol)
	guard(output !== ERR_MARKER, () => `unable to parse R code (see the log for more information) for request ${JSON.stringify(request)}}`)
	return output
}

/**
 * Uses {@link retrieveXmlFromRCode} and returns the nicely formatted object-AST.
 * If successful, allows to further query the last result with {@link retrieveNumberOfRTokensOfLastParse}.
 */
export async function retrieveAstFromRCode(request: RParseRequest, tokenMap: Record<string, string>, shell: RShell, hooks?: DeepPartial<XmlParserHooks>): Promise<RExpressionList> {
	const xml = await retrieveXmlFromRCode(request, shell)
	return await normalize(xml, tokenMap, hooks)
}

/**
 * If the string has (R-)quotes around it, they will be removed, otherwise the string is returned unchanged.
 */
export function removeTokenMapQuotationMarks(str: string): string {
	if (str.length > 1 && (startAndEndsWith(str, '\'') || startAndEndsWith(str, '"'))) {
		return str.slice(1, -1)
	} else {
		return str
	}
}

export type TokenMap = DeepReadonly<Record<string, string>>

export async function getStoredTokenMap(shell: RShell): Promise<TokenMap> {
	await shell.ensurePackageInstalled('xmlparsedata', true /* use some kind of environment in the future */)
	// we invert the token map to get a mapping back from the replacement
	const parsed = parseCSV(await shell.sendCommandWithOutput(
		'write.table(xmlparsedata::xml_parse_token_map,sep=",", col.names=FALSE)'
	))

	if (parsed.some(s => s.length !== 2)) {
		throw new Error(`Expected two columns in token map, but got ${JSON.stringify(parsed)}`)
	}

	// we swap key and value to get the other direction, furthermore we remove quotes from keys if they are quoted
	return parsed.reduce<Record<string, string>>((acc, [key, value]) => {
		acc[value] = removeTokenMapQuotationMarks(key)
		return acc
	}, {})
}

/**
 * Needs to be called *after*  {@link retrieveXmlFromRCode} (or {@link retrieveAstFromRCode})
 */
export async function retrieveNumberOfRTokensOfLastParse(shell: RShell): Promise<number> {
	const result = await shell.sendCommandWithOutput(`cat(nrow(getParseData(flowr_parsed)),${ts2r(shell.options.eol)})`)
	guard(result.length === 1, 'expected exactly one line to obtain the number of R tokens')
	return Number(result[0])
}
