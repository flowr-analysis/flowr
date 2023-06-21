import { NamedXmlBasedJson, XmlBasedJson } from "../../input-format"
import { splitArrayOn } from "../../../../../../../util/arrays"
import { parseLog } from "../../parser"
import { getWithTokenType } from "../meta"
import { ParserData } from "../../data"
import { tryParseOneElementBasedOnType } from "./single-element"
import { tryParseSymbol } from '../values'
import { tryParseUnaryOperation, tryParseBinaryOperation } from '../operators'
import {
  tryParseRepeatLoop,
  tryParseForLoop,
  tryParseWhileLoop
} from '../loops'
import { tryParseIfThenElse, tryParseIfThen } from '../control'
import { Type, RNode } from '../../../../model'
import { log } from '../../../../../../../util/log'
import { tryToParseParameter } from '../functions/parameter'

export function parseBasedOnType(
  data: ParserData,
  obj: XmlBasedJson[] | NamedXmlBasedJson[]
): RNode[] {
  if (obj.length === 0) {
    parseLog.warn("no children received, skipping")
    return []
  }

  let mappedWithName: NamedXmlBasedJson[]

  if(obj[0].name) {
    mappedWithName = obj as NamedXmlBasedJson[]
  } else {
    mappedWithName = getWithTokenType(
      data.config.tokenMap,
      obj as XmlBasedJson[]
    )
  }

  log.trace(`[parseBasedOnType] names: [${mappedWithName.map(({ name }) => name).join(", ")}]`)

  const splitOnSemicolon = splitArrayOn(
    mappedWithName,
    ({ name }) => name === Type.Semicolon
  )

  if (splitOnSemicolon.length > 1) {
    // TODO: check if non-wrapping expr list is correct
    log.trace(`found ${splitOnSemicolon.length} expressions by semicolon-split, parsing them separately`)
    return splitOnSemicolon.flatMap(arr=>
      parseBasedOnType(data, arr)
    )
  }

  /*
   * if splitOnSemicolon.length === 1, we can continue with the normal parsing, but we may have had a trailing semicolon, with this, it is removed as well.
   * splitOnSemicolon.length === 0 is not possible, as we would have had an empty array before, split does not add elements.
   */
  mappedWithName = splitOnSemicolon[0]

  // parse call arguments
  // TODO: fix
  if(mappedWithName.length > 1 && mappedWithName[0].name === Type.ParenLeft && mappedWithName[mappedWithName.length - 1].name === Type.ParenRight) {
    log.trace(`found parenthesized expression, parsing it separately`)
    const args = splitArrayOn(mappedWithName.slice(1, mappedWithName.length - 1), ({ name }) => name === Type.Comma)
    let parsedArgs: RNode[] | undefined = []
    for(const argList of args) {
      const parsed = tryToParseParameter(data, argList)
      if(parsed !== undefined) {
        log.info(`parsed in arg list: ${JSON.stringify(parsed)}`)
        parsedArgs?.push(parsed)
      } else {
        log.warn(`parsed fail in arg list: ${JSON.stringify(parsed)}, but expected only one element, abort`)
        parsedArgs = undefined
      }
    }
    if(parsedArgs !== undefined) {
      return parsedArgs
    }
  }


  if (mappedWithName.length === 1) {
    const parsed = tryParseOneElementBasedOnType(data, mappedWithName[0])
    return parsed !== undefined ? [parsed] : []
  } else if (mappedWithName.length === 2) {
    const unaryOp = tryParseUnaryOperation(
      data,
      mappedWithName[0],
      mappedWithName[1]
    )
    if (unaryOp !== undefined) {
      return [unaryOp]
    }
    const repeatLoop = tryParseRepeatLoop(
      data,
      mappedWithName[0],
      mappedWithName[1]
    )
    if (repeatLoop !== undefined) {
      return [repeatLoop]
    }
  } else if (mappedWithName.length === 3) {
    const binary = tryParseBinaryOperation(
      data,
      mappedWithName[0],
      mappedWithName[1],
      mappedWithName[2]
    )
    if (binary !== undefined) {
      return [binary]
    } else {
      // TODO: maybe-monad pass through? or just use undefined (see ts-fp)
      const forLoop = tryParseForLoop(
        data,
        mappedWithName[0],
        mappedWithName[1],
        mappedWithName[2]
      )
      if (forLoop !== undefined) {
        return [forLoop]
      } else {
        // could be a symbol with namespace information
        const symbol = tryParseSymbol(data, mappedWithName)
        if (symbol !== undefined) {
          return [symbol]
        }
      }
      // TODO: try to parse symbols with namespace information
    }
  } else if (mappedWithName.length === 5) {
    const ifThen = tryParseIfThen(data, [
      mappedWithName[0],
      mappedWithName[1],
      mappedWithName[2],
      mappedWithName[3],
      mappedWithName[4],
    ])
    if (ifThen !== undefined) {
      return [ifThen]
    } else {
      const whileLoop = tryParseWhileLoop(
        data,
        mappedWithName[0],
        mappedWithName[1],
        mappedWithName[2],
        mappedWithName[3],
        mappedWithName[4]
      )
      if (whileLoop !== undefined) {
        return [whileLoop]
      }
    }
  } else if (mappedWithName.length === 7) {
    const ifThenElse = tryParseIfThenElse(data, [
      mappedWithName[0],
      mappedWithName[1],
      mappedWithName[2],
      mappedWithName[3],
      mappedWithName[4],
      mappedWithName[5],
      mappedWithName[6],
    ])
    if (ifThenElse !== undefined) {
      return [ifThenElse]
    }
  }

  // otherwise perform default parsing
  return parseNodesWithUnknownType(data, mappedWithName)
}

export function parseNodesWithUnknownType(data: ParserData, mappedWithName: NamedXmlBasedJson[]) {
  const parsedNodes: RNode[] = []
  // used to indicate the new root node of this set of nodes
  // TODO: refactor?
  // TODO: allow to configure #name
  for (const elem of mappedWithName) {
    const retrieved = tryParseOneElementBasedOnType(data, elem)
    if (retrieved !== undefined) {
      parsedNodes.push(retrieved)
    }
  }
  return parsedNodes
}
