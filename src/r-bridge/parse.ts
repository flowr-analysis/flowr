// TODO: global entrypoint for configuration of the parser and all components

import { RShell } from './shell'
import * as xml2js from 'xml2js'
import { valueToR } from './lang'
import { EOL } from 'os'

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
export async function retrieveXmlFromRCode(request: RParseRequest): Promise<string> {
  const shell = new RShell()

  try {
    // first of all we ensure, that we have xmlparsedata and load it
    const { tempdir } = await shell.ensurePackageInstalled('xmlparsedata')

    const libLoc = tempdir === undefined ? '' : `, lib.loc="${tempdir}"`
    shell.sendCommands(`library(xmlparsedata${libLoc})`,
      `parsed <- parse(${request.request} = "${request.content}", keep.source = ${valueToR(request.attachSourceInformation)})`,
      `output <- xmlparsedata::xml_parse_data(parsed, includeText = ${valueToR(request.attachSourceInformation)}, pretty = FALSE)`
    )
    const xml = await shell.sendCommandWithOutput('cat(output)')

    // TODO: keep configuration consistent
    return xml.join(EOL)
  } finally {
    shell.close()
  }
}

// TODO: type ast etc
/**
 * uses {@link #retrieveXmlFromRCode} and returns the nicely formatted object-AST
 */
export async function retrieveAstFromRCode(request: RParseRequest): Promise<object> {
  const xml = await retrieveXmlFromRCode(request)
  return await xml2js.parseStringPromise(xml, { /* TODO: validator: undefined */ })
}
