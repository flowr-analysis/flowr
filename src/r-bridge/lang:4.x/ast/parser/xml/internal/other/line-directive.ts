import { XmlBasedJson } from '../../input-format'
import { RLineDirective, Type } from '../../../../model'
import { parseLog } from '../../parser'
import { retrieveMetaStructure } from '../meta'
import { guard } from '../../../../../../../util/assert'
import { executeHook } from '../../hooks'
import { ParserData } from '../../data'

const LineDirectiveRegex = /^#line\s+(\d+)\s+"([^"]+)"\s*$/

/**
 * Parse the given object as an R line directive (`#line <number> "<file>"`).
 * This requires you to check the corresponding name beforehand.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj  - The json object to extract the meta-information from
 */
export function parseLineDirective(data: ParserData, obj: XmlBasedJson): RLineDirective {
  parseLog.debug(`[line-directive]`)
  obj = executeHook(data.hooks.other.onLineDirective.before, data, obj)

  const { location, content } = retrieveMetaStructure(data.config, obj)
  guard(content.startsWith('#line'), 'line directive must start with #line')
  const match = LineDirectiveRegex.exec(content)
  guard(match !== null, () => `line directive must match regex ${LineDirectiveRegex.source} but does not ${JSON.stringify(content)}`)

  const result: RLineDirective = {
    type:   Type.LineDirective,
    location,
    line:   parseInt(match[1]),
    file:   match[2],
    lexeme: content,
    info:   {
      fullRange:        data.currentRange,
      additionalTokens: [],
      fullLexeme:       content
    }
  }
  return executeHook(data.hooks.other.onLineDirective.after, data, result)
}
