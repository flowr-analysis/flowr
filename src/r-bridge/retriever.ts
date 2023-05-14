import { type RShell } from "./shell"
import { parseCSV, ts2r, XmlParserHooks, RExpressionList, parse } from './lang:4.x'
import { startAndEndsWith } from '../util/strings'
import { DeepPartial } from 'ts-essentials'
import { guard } from '../util/assert'

export interface RParseRequestFromFile {
  request: "file";
  /** the path to the file (absolute paths are probably best here */
  content: string;
}

export interface RParseRequestFromText {
  request: 'text'
  /* source code to parse (not a file path) */
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
 * throws if the file could not be parsed
 */
export async function retrieveXmlFromRCode(request: RParseRequest, shell: RShell): Promise<string> {
  if (request.ensurePackageInstalled) {
    await shell.ensurePackageInstalled('xmlparsedata', true)
  }

  shell.sendCommands(`flowr_output <- "${ERR_MARKER}"`,
    // now, try to retrieve the ast
    `try(flowr_parsed <- parse(${request.request} = ${JSON.stringify(request.content)}, keep.source = ${ts2r(request.attachSourceInformation)}), silent=FALSE)`,
    `try(flowr_output <- xmlparsedata::xml_parse_data(flowr_parsed, includeText = ${ts2r(request.attachSourceInformation)}, pretty = FALSE), silent=FALSE)`
  )
  // TODO: let commands produce output by cat wrapper/shell.command creator to abstract from this?
  const xml = await shell.sendCommandWithOutput(`cat(flowr_output,${ts2r(shell.options.eol)})`)
  const output = xml.join(shell.options.eol)
  guard(output !== ERR_MARKER, 'unable to parse R code (see the log for more information)')
  return output
}

// TODO: type ast etc
/**
 * uses {@link retrieveXmlFromRCode} and returns the nicely formatted object-AST
 */
export async function retrieveAstFromRCode(request: RParseRequest, tokenMap: Record<string, string>, shell: RShell, hooks?: DeepPartial<XmlParserHooks>): Promise<RExpressionList> {
  const xml = await retrieveXmlFromRCode(request, shell)
  return await parse(xml, tokenMap, hooks)
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

export async function getStoredTokenMap(shell: RShell): Promise<Record<string, string>> {
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
