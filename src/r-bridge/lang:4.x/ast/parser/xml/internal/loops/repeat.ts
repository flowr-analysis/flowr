import { NamedXmlBasedJson } from '../../input-format'
import { retrieveMetaStructure } from '../meta'
import { parseLog } from '../../parser'
import { ParserData } from '../../data'
import { tryParseOneElementBasedOnType } from '../structure'
import { Type } from '../../../../model'
import { RRepeatLoop } from '../../../../model'
import { guard } from '../../../../../../../util/assert'
import { executeHook, executeUnknownHook } from '../../hooks'

/**
 * Try to parse the construct as a {@link RRepeatLoop}.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param repeatToken - Token which represents the `repeat` keyword
 * @param body - The `body` of the repeat-loop
 *
 * @returns The parsed {@link RRepeatLoop} or `undefined` if the given construct is not a repeat-loop
 */
export function tryParseRepeatLoopStructure(data: ParserData, repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson): RRepeatLoop | undefined {
  if (repeatToken.name !== Type.Repeat) {
    parseLog.debug('encountered non-repeat token for supposed repeat-loop structure')
    return executeUnknownHook(data.hooks.loops.onRepeatLoop.unknown, data, { repeatToken, body })
  }

  parseLog.debug(`trying to parse repeat-loop with ${JSON.stringify([repeatToken, body])}`);
  ({ repeatToken, body } = executeHook(data.hooks.loops.onRepeatLoop.before, data, { repeatToken, body }))

  const parseBody = tryParseOneElementBasedOnType(data, body)
  guard(parseBody !== undefined, `no body for repeat-loop ${JSON.stringify(repeatToken)} (${JSON.stringify(body)})`)

  const {
    location,
    content
  } = retrieveMetaStructure(data.config, repeatToken.content)
  const result: RRepeatLoop = {
    type:   Type.Repeat,
    location,
    lexeme: content,
    body:   parseBody,
    info:   {}
  }
  return executeHook(data.hooks.loops.onRepeatLoop.after, data, result)
}
