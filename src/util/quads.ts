/**
 * As other project partners want the produced data structures as rdf quads, this module provides
 * serialization capabilities for this purpose.
 * <p>
 * At the time of writing this module I am unaware of any sophisticated rdf library for typescript which allows to serialize objects
 * directly as rdf quads. Therefore, this module provides a simple serialization mechanism based on the popular n3.js library.
 *
 * @module
 */

import { DataFactory, Quad, Writer } from 'n3'
import namedNode = DataFactory.namedNode
import quad = DataFactory.quad
import { deepMergeObject, isObjectOrArray, MergeableRecord } from './objects'
import { guard } from './assert'
import { decorateAst, getStoredTokenMap, retrieveAstFromRCode, RShell } from '../r-bridge'
import { DefaultMap } from './defaultmap'
import literal = DataFactory.literal

const domain = 'https://uni-ulm.de/r-ast/'

type RecordForQuad = Record<string, unknown>
type IgnoreIf = (key: string, value: unknown) => boolean

/**
 * Deterministically retrieve a unique id for a given object.
 */
export type QuadIdRetriever = (obj: RecordForQuad) => string

export type QuadContextRetriever = (obj: RecordForQuad) => string

export function defaultQuadIdGenerator(): QuadIdRetriever {
  let counter = 0
  const idMap = new DefaultMap<RecordForQuad, number>( () => counter++ )
  return (elem: RecordForQuad) => String(idMap.get(elem))
}

export function defaultQuadIgnoreIf(): IgnoreIf {
  return (key: string, value: unknown) => value === undefined
}

/**
 * See {@link DefaultQuadSerializationConfiguration} for defaults.
 */
export interface QuadSerializationConfiguration extends MergeableRecord {
  /**
   * Ignore certain keys or values when serializing to quads.
   * @see defaultQuadIgnoreIf
   */
  ignore:  IgnoreIf
  /**
   * Retrieve a unique id for a given object.
   * @see defaultQuadIdGenerator
   */
  getId:   QuadIdRetriever
  /**
   * The context of the serialized quads, probably the file-name (constant) or whatever is desired.
   */
  context: QuadContextRetriever
  /**
   * The basic domain name to use for the quads.
   */
  domain:  string
}

export const DefaultQuadSerializationConfiguration: QuadSerializationConfiguration = {
  ignore:  defaultQuadIgnoreIf(),
  getId:   defaultQuadIdGenerator(),
  context: () => 'unknown-context',
  domain:  "https://uni-ulm.de/r-ast/"
}

/**
 * Serializes the given object or array to rdf quads.
 */
export function serialize2quads(obj: RecordForQuad, config?: Partial<QuadSerializationConfiguration>): void {
  const useConfig = deepMergeObject(DefaultQuadSerializationConfiguration, config)
  guard(isObjectOrArray(obj), 'cannot serialize non-object to rdf!')
  guard(!Array.isArray(obj), 'cannot serialize arrays!')

  const writer = new Writer(process.stdout, { format: 'N-Quads' })
  serializeObject(obj, writer, useConfig)
}


function serializeObject<T extends RecordForQuad>(obj: RecordForQuad, writer: Writer<Quad>, config: QuadSerializationConfiguration): void {
  for(const [key, value] of Object.entries(obj)) {
    if(config.ignore(key, value)) {
      continue
    }
    // console.log( key, value, context)
    if(isObjectOrArray(value)) {
      if(Array.isArray(value)) {
        for(const [index, element] of value.entries()) {
          writer.addQuad(quad(
            namedNode(domain + config.getId(obj)),
            namedNode(domain + key + "-" + String(index)),
            namedNode(domain + config.getId(element as T)),
            namedNode(config.context(obj)),
          ))
          serializeObject(element as T, writer, config)
        }
      } else {
        writer.addQuad(quad(
          namedNode(domain + config.getId(obj)),
          namedNode(domain + key),
          namedNode(domain + config.getId(value as T)),
          namedNode(config.context(obj)),
        ))
        serializeObject(value as T, writer, config)
      }
    } else {
      writer.addQuad(quad(
        namedNode(domain + config.getId(obj)),
        namedNode(domain + key),
        literal(String(value), typeof(value) /*, literal with typeof(value) */),
        namedNode(config.context(obj)),
      ))
    }
  }
}



// TODO: remove
async function test() {
  const shell = new RShell()
  shell.tryToInjectHomeLibPath()
  const tokenMap = await getStoredTokenMap(shell)
  const ast = await retrieveAstFromRCode({ request: 'text', content: 'x <- 1', ensurePackageInstalled: true, attachSourceInformation: true }, tokenMap, shell)
  shell.close()
  const decorated = decorateAst(ast).decoratedAst

  serialize2quads(decorated, {
    context: () => 'random-input',
  })
}

// void test()
