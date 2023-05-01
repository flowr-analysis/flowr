import { NamedXmlBasedJson, XmlBasedJson } from "../../input-format"
import { splitArrayOn } from "../../../../../../../util/arrays"
import { parseLog } from "../../parser"
import { getWithTokenType } from "../meta"
import { ParserData } from "../../data"
import { tryParseOneElementBasedOnType } from "./single-element"
import { parseSymbol } from "../values/symbol"
import { tryParseUnaryStructure } from "../operators/unary"
import { tryParseRepeatLoopStructure } from "../loops/repeat"
import { tryParseIfThenElseStructure } from "../control/if-then-else"
import { tryParseForLoopStructure } from "../loops/for"
import { tryParseWhileLoopStructure } from "../loops/while"
import { tryParseBinaryStructure } from "../operators/binary"
import { tryParseIfThenStructure } from "../control/if-then"
import { Type } from "../../../../model/type"
import { RNode } from "../../../../model/model"

export function parseBasedOnType(
  data: ParserData,
  obj: XmlBasedJson[]
): RNode[] {
  if (obj.length === 0) {
    parseLog.warn("no children received, skipping")
    return []
  }

  const mappedWithName: NamedXmlBasedJson[] = getWithTokenType(
    data.config.tokenMap,
    obj
  )

  // TODO: some more performant way, so that when redoing this recursively we don't have to extract names etc. again
  const splitOnSemicolon = splitArrayOn(
    mappedWithName,
    ({ name }) => name === Type.Semicolon
  )
  if (splitOnSemicolon.length > 1) {
    // TODO: check if non-wrapping expr list is correct
    return splitOnSemicolon.flatMap((arr) =>
      parseBasedOnType(
        data,
        arr.map(({ content }) => content)
      )
    )
  }

  // TODO: improve with error message and ensure no semicolon
  if (mappedWithName.length === 1) {
    const parsed = tryParseOneElementBasedOnType(data, mappedWithName[0])
    return parsed !== undefined ? [parsed] : []
  } else if (mappedWithName.length === 2) {
    const unaryOp = tryParseUnaryStructure(
      data,
      mappedWithName[0],
      mappedWithName[1]
    )
    if (unaryOp !== undefined) {
      return [unaryOp]
    }
    const repeatLoop = tryParseRepeatLoopStructure(
      data,
      mappedWithName[0],
      mappedWithName[1]
    )
    if (repeatLoop !== undefined) {
      return [repeatLoop]
    }
  } else if (mappedWithName.length === 3) {
    const binary = tryParseBinaryStructure(
      data,
      mappedWithName[0],
      mappedWithName[1],
      mappedWithName[2]
    )
    if (binary !== undefined) {
      return [binary]
    } else {
      // TODO: maybe-monad pass through? or just use undefined (see ts-fp)
      const forLoop = tryParseForLoopStructure(
        data,
        mappedWithName[0],
        mappedWithName[1],
        mappedWithName[2]
      )
      if (forLoop !== undefined) {
        return [forLoop]
      } else {
        // could be a symbol with namespace information
        const symbol = parseSymbol(data.config, mappedWithName)
        if (symbol !== undefined) {
          return [symbol]
        }
      }
      // TODO: try to parse symbols with namespace information
    }
  } else if (mappedWithName.length === 5) {
    const ifThen = tryParseIfThenStructure(data, [
      mappedWithName[0],
      mappedWithName[1],
      mappedWithName[2],
      mappedWithName[3],
      mappedWithName[4],
    ])
    if (ifThen !== undefined) {
      return [ifThen]
    } else {
      const whileLoop = tryParseWhileLoopStructure(
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
    const ifThenElse = tryParseIfThenElseStructure(data, [
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
