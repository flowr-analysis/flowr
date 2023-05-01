import { getKeysGuarded, XmlBasedJson, XmlParseError } from "../input-format"
import { rangeFrom, SourceRange } from "../../../../../../util/range"
import { XmlParserConfig } from "../config"

/**
 * if the passed object is an array with only one element, remove the array wrapper
 */
export function objectWithArrUnwrap (obj: XmlBasedJson[] | XmlBasedJson): XmlBasedJson {
  if (Array.isArray(obj)) {
    if (obj.length !== 1) {
      throw new XmlParseError(`expected only one element in the wrapped array, yet received ${JSON.stringify(obj)}`)
    }
    return obj[0]
  } else if (typeof obj === 'object') {
    return obj
  } else {
    throw new XmlParseError(`expected array or object, yet received ${JSON.stringify(obj)}`)
  }
}

/**
 * given a xml element, extract the source location of the corresponding element in the R-ast
 */
export function extractLocation (ast: XmlBasedJson): SourceRange {
  const {
    line1,
    col1,
    line2,
    col2
  } = getKeysGuarded<string>(ast, 'line1', 'col1', 'line2', 'col2')
  return rangeFrom(line1, col1, line2, col2)
}

/**
 * The json object that represents the input xml contains various meta-information.
 * This function extracts the meta-information and returns it.
 *
 * @param config - the configuration of the parser to use to retrieve the corresponding name fields
 * @param obj - the json object to extract the meta-information from
 */
export function retrieveMetaStructure (config: XmlParserConfig, obj: XmlBasedJson): {
  /** the obj passed in, but potentially without surrounding array wrappers (see {@link objectWithArrUnwrap}) */
  unwrappedObj: XmlBasedJson
  /** location information of the corresponding R-ast element */
  location:     SourceRange
  content:      string
} {
  const unwrappedObj = objectWithArrUnwrap(obj)
  const core = getKeysGuarded<any>(unwrappedObj, config.contentName, config.attributeName)
  const location = extractLocation(core[config.attributeName])
  const content = core[config.contentName]
  return {
    unwrappedObj,
    location,
    content
  }
}
