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
type DataForQuad = Record<string, unknown> | ArrayLike<unknown>

/**
 * Predicate that allows you to ignore given elements based on their key/value
 *
 * @returns true if the given key/value should be ignored, false otherwise
 */
export type QuadIgnoreIf = (key: string, value: unknown) => boolean

/**
 * Deterministically retrieve a unique id for a given object.
 */
export type QuadIdRetriever = (obj: unknown) => string

/**
 * Either a constant string or a supplier depending on the object in question
 */
export type QuadContextRetriever = string | ((obj: DataForQuad) => string)

/**
 * A deterministic counting id generator for quads.
 */
export function defaultQuadIdGenerator(): QuadIdRetriever {
  let counter = 0
  const idMap = new DefaultMap<unknown, number>( () => counter++ )
  return (elem: unknown) => String(idMap.get(elem))
}

export function defaultQuadIgnoreIf(): QuadIgnoreIf {
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
  ignore?: QuadIgnoreIf
  /**
   * Retrieve a unique id for a given object.
   * @see defaultQuadIdGenerator
   */
  getId?:  QuadIdRetriever
  /**
   * The context of the serialized quads, probably the file-name (constant) or whatever is desired.
   */
  context: QuadContextRetriever
  /**
   * The basic domain name to use for the quads.
   */
  domain?: string
}

export const DefaultQuadSerializationConfiguration: Required<QuadSerializationConfiguration> = {
  ignore:  defaultQuadIgnoreIf(),
  getId:   defaultQuadIdGenerator(),
  context: 'unknown-context',
  domain:  "https://uni-ulm.de/r-ast/"
}

function retrieveContext(context: QuadContextRetriever, obj: DataForQuad): string {
  return typeof context === 'string' ? context : context(obj)
}

/**
 * Serializes the given object or array to rdf quads.
 *
 * @param obj - the object to serialize (must be a Record and no array etc.)
 * @param config - further configuration options
 */
export function serialize2quads(obj: RecordForQuad, config: QuadSerializationConfiguration): void {
  const useConfig = deepMergeObject(DefaultQuadSerializationConfiguration, config)
  guard(isObjectOrArray(obj), 'cannot serialize non-object to rdf!')
  guard(!Array.isArray(obj), 'cannot serialize arrays!')

  const writer = new Writer(process.stdout, { format: 'N-Quads' })
  serializeObject(obj, writer, useConfig)
}


function processArrayEntries(key: string, value: unknown[], obj: DataForQuad, writer: Writer<Quad>, config:  Required<QuadSerializationConfiguration>) {
  for (const [index, element] of value.entries()) {
    writer.addQuad(quad(
      namedNode(domain + config.getId(obj)),
      namedNode(domain + key + '-' + String(index)),
      namedNode(domain + config.getId(element)),
      namedNode(retrieveContext(config.context, obj))
    ))
    guard(isObjectOrArray(element), `cannot serialize non-object to rdf within array of ${JSON.stringify(value)}!`)
    serializeObject(element as DataForQuad, writer, config)
  }
}

function processObjectEntries(key: string, value: unknown, obj: DataForQuad, writer: Writer<Quad>, config:  Required<QuadSerializationConfiguration>) {
  writer.addQuad(quad(
    namedNode(domain + config.getId(obj)),
    namedNode(domain + key),
    namedNode(domain + config.getId(value)),
    namedNode(retrieveContext(config.context, obj))
  ))
  serializeObject(value as DataForQuad, writer, config)
}

function processLiteralEntry(value: unknown, key: string, obj: DataForQuad, writer: Writer<Quad>, config: Required<QuadSerializationConfiguration>) {
  writer.addQuad(quad(
    namedNode(domain + config.getId(obj)),
    namedNode(domain + key),
    literal(String(value), typeof (value) /*, literal with typeof(value) */),
    namedNode(retrieveContext(config.context, obj))
  ))
}

function processObjectEntry(key: string, value: unknown, obj: DataForQuad, writer: Writer<Quad>, config:  Required<QuadSerializationConfiguration>) {
  if (isObjectOrArray(value)) {
    if (Array.isArray(value)) {
      processArrayEntries(key, value, obj, writer, config)
    } else {
      processObjectEntries(key, value, obj, writer, config)
    }
  } else {
    processLiteralEntry(value, key, obj, writer, config)
  }
}

function serializeObject(obj: DataForQuad, writer: Writer<Quad>, config: Required<QuadSerializationConfiguration>): void {
  for(const [key, value] of Object.entries(obj)) {
    if(config.ignore(key, value)) {
      continue
    }
    processObjectEntry(key, value, obj, writer, config)
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
    context: 'random-input',
  })
}

// void test()
