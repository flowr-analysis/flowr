// TODO: global entrypoint for configuration of the parser and all components

import { RShell } from './shell'
import { parseCSV, valueToR } from './lang/values'
import { parse } from './lang/ast/parser'
import { type RExprList } from './lang/ast/model'

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
}

type RParseRequest = (RParseRequestFromFile | RParseRequestFromText) & RParseRequestBase

/**
 * Provides the capability to parse R files/R code using the R parser.
 * Depends on {@link RShell} to provide a connection to R.
 */
export async function retrieveXmlFromRCode(request: RParseRequest, shell = new RShell()): Promise<string> {
  try {
    await shell.ensurePackageInstalled('xmlparsedata', true)

    shell.sendCommands(
      `parsed <- parse(${request.request} = ${valueToR(request.content)}, keep.source = ${valueToR(request.attachSourceInformation)})`,
      `output <- xmlparsedata::xml_parse_data(parsed, includeText = ${valueToR(request.attachSourceInformation)}, pretty = FALSE)`
    )
    // TODO: let commands produce output by cat wrapper/shell.command creator to abstract from this?
    const xml = await shell.sendCommandWithOutput(`cat(output,${valueToR(shell.options.eol)})`)

    return xml.join(shell.options.eol)
  } finally {
    shell.close()
  }
}

// TODO: type ast etc
/**
 * uses {@link #retrieveXmlFromRCode} and returns the nicely formatted object-AST
 */
export async function retrieveAstFromRCode(request: RParseRequest, tokenMap: Record<string, string>, shell = new RShell()): Promise<RExprList> {
  const xml = await retrieveXmlFromRCode(request, shell)
  return await parse(xml, tokenMap)
}

export async function getStoredTokenMap(shell: RShell): Promise<Record<string, string>> {
  await shell.ensurePackageInstalled('xmlparsedata', false)
  // we invert the token map to get a mapping back from the replacement
  const parsed = parseCSV(await shell.sendCommandWithOutput(
    '(function() { x <- xmlparsedata::xml_parse_token_map; x <- setNames(names(x),x); write.table(x,sep=",", col.names=FALSE) })()'
  ))

  if (parsed.some(s => s.length !== 2)) {
    throw new Error(`Expected two columns in token map, but got ${JSON.stringify(parsed)}`)
  }

  return parsed.reduce<Record<string, string>>((acc, [key, value]) => { acc[key] = value; return acc }, {})
}
