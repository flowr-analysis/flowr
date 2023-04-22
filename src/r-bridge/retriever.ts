// TODO: global entrypoint for configuration of the parser and all components

import { type RShell } from './shell'
import { parseCSV, ts2r } from './lang:4.x/values'
import { parse } from './lang:4.x/ast/parser'
import { type RExprList } from './lang:4.x/ast/model'
import { startAndEndsWith } from '../util/strings'

interface RParseRequestFromFile {
  request: 'file'
  content: string
}

interface RParseRequestFromText {
  request: 'text'
  content: string
}

interface RParseRequestBase {
  attachSourceInformation: boolean
  ensurePackageInstalled:  boolean
}

type RParseRequest = (RParseRequestFromFile | RParseRequestFromText) & RParseRequestBase

/**
 * Provides the capability to parse R files/R code using the R parser.
 * Depends on {@link RShell} to provide a connection to R.
 */
export async function retrieveXmlFromRCode (request: RParseRequest, shell: RShell): Promise<string> {
  if (request.ensurePackageInstalled) {
    await shell.ensurePackageInstalled('xmlparsedata', true)
  }

  shell.sendCommands(
    `parsed <- parse(${request.request} = ${JSON.stringify(request.content)}, keep.source = ${ts2r(request.attachSourceInformation)})`,
    `output <- xmlparsedata::xml_parse_data(parsed, includeText = ${ts2r(request.attachSourceInformation)}, pretty = FALSE)`
  )
  // TODO: let commands produce output by cat wrapper/shell.command creator to abstract from this?
  const xml = await shell.sendCommandWithOutput(`cat(output,${ts2r(shell.options.eol)})`)

  return xml.join(shell.options.eol)
}

// TODO: type ast etc
/**
 * uses {@link #retrieveXmlFromRCode} and returns the nicely formatted object-AST
 */
export async function retrieveAstFromRCode (request: RParseRequest, tokenMap: Record<string, string>, shell: RShell): Promise<RExprList> {
  const xml = await retrieveXmlFromRCode(request, shell)
  return await parse(xml, tokenMap)
}

/**
 * If the string has (R-)quotes around it, they will be removed, otherwise the string is returned unchanged.
 */
export function removeTokenMapQuotationMarks (str: string): string {
  if (str.length > 1 && (startAndEndsWith(str, '\'') || startAndEndsWith(str, '"'))) {
    return str.slice(1, -1)
  } else {
    return str
  }
}

export async function getStoredTokenMap (shell: RShell): Promise<Record<string, string>> {
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
