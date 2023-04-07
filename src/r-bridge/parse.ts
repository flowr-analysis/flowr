// TODO: global entrypoint for configuration of the parser and all components

import { RShellSession } from './rshell'
import * as xml2js from 'xml2js'
import { valueToR } from './r-lang'

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
 * Depends on {@link RShellSession} to provide a connection to R.
 */
export async function retrieveXmlFromRCode (req: RParseRequest): Promise<string> {
  const session = new RShellSession()

  return await new Promise<string>((resolve, reject) => {
    // TODO: allow to configure timeout
    const timer = setTimeout(() => { reject(new Error('timeout')) }, 5000)

    session.onData(data => {
      clearTimeout(timer)
      resolve(data.toString())
    })

    session.sendCommands('require(xmlparsedata)',
        `parsed <- parse(${req.request} = "${req.content}", keep.source = ${valueToR(req.attachSourceInformation)})`,
        `output <- xmlparsedata::xml_parse_data(parsed, includeText = ${valueToR(req.attachSourceInformation)})`,
        'cat(output)'
    )
  }).finally(() => { session.close() })
}

// TODO: type ast etc
/**
 * uses {@link #retrieveXmlFromRCode} and returns the nicely formatted object-AST
 */
export async function retrieveAstFromRCode (filename: RParseRequest): Promise<object> {
  const xml = await retrieveXmlFromRCode(filename)
  return await xml2js.parseStringPromise(xml, { validator: undefined /* TODO */ })
}
