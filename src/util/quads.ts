/**
 * As other project partners want the produced data structures as rdf quads, this module provides
 * serialization capabilities for this purpose.
 * <p>
 * At the time of writing this module I am unaware of any sophisticated rdf library for typescript which allows to serialize objects
 * directly as rdf quads. Therefore, this module provides a simple serialization mechanism based on the popular n3.js library.
 *
 * @module
 */

import { DataFactory, NamedNode, Quad, Writer } from 'n3'
import namedNode = DataFactory.namedNode
import quad = DataFactory.quad
import { deepMergeObject, isObjectOrArray, MergeableRecord } from './objects'
import { guard } from './assert'
import { DefaultMap } from './defaultmap'
import literal = DataFactory.literal
import { log } from "./log"

const domain = 'https://uni-ulm.de/r-ast/'

type RecordForQuad = Record<string, unknown>
type DataForQuad = Record<string, unknown> | ArrayLike<unknown>
type ContextForQuad = string

/**
 * Predicate that allows you to ignore given elements based on their key/value
 *
 * @returns true if the given key/value should be ignored, false otherwise
 */
export type QuadIgnoreIf = (key: string, value: unknown) => boolean

/**
 * Deterministically retrieve a unique id for a given object.
 * @param obj - the object to retrieve the id for
 * @param context - In order to provide unique ids even for different contexts, we add the context to the id.
 */
export type QuadIdRetriever = (obj: unknown, context: ContextForQuad) => string

/**
 * Either a constant string or a supplier depending on the object in question
 */
export type QuadContextRetriever = ContextForQuad | ((obj: DataForQuad) => ContextForQuad)

/**
 * A deterministic counting id generator for quads.
 */
export function defaultQuadIdGenerator(): QuadIdRetriever {
  let counter = 0
  const idMap = new DefaultMap<unknown, number>( () => counter++ )
  return (elem: unknown, context: ContextForQuad) => `${context}/${idMap.get(elem)}`
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
  context: 'unknown-context',
  getId:   defaultQuadIdGenerator(),
  domain:  "https://uni-ulm.de/r-ast/"
}

function retrieveContext(context: QuadContextRetriever, obj: DataForQuad): string {
  return typeof context === 'string' ? context : context(obj)
}


const writer = new Writer( { format: 'N-Quads' })

/**
 * Serializes the given object or array to rdf quads.
 *
 * @param obj - the object to serialize (must be a Record and no array etc.)
 * @param config - further configuration options
 *
 * @returns the serialized quads
 */
export function serialize2quads(obj: RecordForQuad, config: QuadSerializationConfiguration): string {
  const useConfig = deepMergeObject(DefaultQuadSerializationConfiguration, config)
  guard(isObjectOrArray(obj), 'cannot serialize non-object to rdf!')
  guard(!Array.isArray(obj), 'cannot serialize arrays!')

  const quads: Quad[] = []
  serializeObject(obj, quads, useConfig)
  return writer.quadsToString(quads)
}


function processArrayEntries(key: string, value: unknown[], obj: DataForQuad, quads: Quad[], config:  Required<QuadSerializationConfiguration>) {
  for (const [index, element] of value.entries()) {
    const context= retrieveContext(config.context, obj)
    quads.push(quad(
      namedNode(domain + config.getId(obj, context)),
      namedNode(domain + key + '-' + String(index)),
      namedNode(domain + config.getId(element, context)),
      namedNode(context)
    ))
    guard(isObjectOrArray(element), () => `cannot serialize non-object to rdf within array of ${JSON.stringify(value)}!`)
    serializeObject(element as DataForQuad, quads, config)
  }
}

function processObjectEntries(key: string, value: unknown, obj: DataForQuad, quads: Quad[], config:  Required<QuadSerializationConfiguration>) {
  const context = retrieveContext(config.context, obj)
  quads.push(quad(
    namedNode(domain + config.getId(obj, context)),
    namedNode(domain + key),
    namedNode(domain + config.getId(value, context)),
    namedNode(context)
  ))
  serializeObject(value as DataForQuad, quads, config)
}

function objToType(value: unknown): NamedNode | undefined {
  let suffix: string | undefined
  switch (typeof value) {
    case 'string': suffix = 'string'; break
    case 'number': suffix = Number.isInteger(value) ? 'integer' : 'decimal'; break
    case 'boolean': suffix = 'boolean'; break
    case 'bigint': suffix = 'integer'; break
    default: log.warn(`unknown ${typeof value} with ${JSON.stringify(value)}`); break
  }
  return suffix ? namedNode(`http://www.w3.org/2001/XMLSchema#${suffix}`) : undefined
}

function processLiteralEntry(value: unknown, key: string, obj: DataForQuad, quads: Quad[], config: Required<QuadSerializationConfiguration>) {
  const context = retrieveContext(config.context, obj)
  quads.push(quad(
    namedNode(domain + config.getId(obj, context)),
    namedNode(domain + key),
    literal(String(value), objToType(value)),
    namedNode(context)
  ))
}

function processObjectEntry(key: string, value: unknown, obj: DataForQuad, quads: Quad[], config:  Required<QuadSerializationConfiguration>) {
  if (isObjectOrArray(value)) {
    if (Array.isArray(value)) {
      processArrayEntries(key, value, obj, quads, config)
    } else {
      processObjectEntries(key, value, obj, quads, config)
    }
  } else {
    processLiteralEntry(value, key, obj, quads, config)
  }
}

function serializeObject(obj: DataForQuad, quads: Quad[], config: Required<QuadSerializationConfiguration>): void {
  for(const [key, value] of Object.entries(obj)) {
    if(config.ignore(key, value)) {
      continue
    }
    processObjectEntry(key, value, obj, quads, config)
  }
}
