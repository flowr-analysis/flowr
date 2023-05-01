import { NamedXmlBasedJson, XmlParseError } from "../../input-format"
import * as Lang from "../../../../model"
import { BinaryOperatorFlavor } from "../../../../model"
import { parseLog } from "../../parser"
import { ensureChildrenAreLhsAndRhsOrdered, retrieveMetaStructure, retrieveOpName } from "../meta"
import { identifySpecialOp } from "./special"
import { ParserData } from "../../data"
import { tryParseOneElementBasedOnType } from "../structure/single-element"

export function parseBinaryStructure (data: ParserData, lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson): Lang.RNode | undefined {
  parseLog.trace(`binary op for ${lhs.name} [${op.name}] ${rhs.name}`)
  let flavor: BinaryOperatorFlavor | 'special'
  // TODO: filter for binary!
  if (Lang.ArithmeticOperatorsRAst.includes(op.name)) {
    flavor = 'arithmetic'
  } else if (Lang.ComparisonOperatorsRAst.includes(op.name)) {
    flavor = 'comparison'
  } else if (Lang.LogicalOperatorsRAst.includes(op.name)) {
    flavor = 'logical'
  } else if (Lang.AssignmentsRAst.includes(op.name)) {
    flavor = 'assignment'
  } else if (Lang.Type.Special === op.name) {
    flavor = 'special'
  } else {
    return undefined
  }
  // TODO: identify op name correctly
  return parseBinaryOp(data, flavor, lhs, op, rhs)
}

function parseBinaryOp (data: ParserData, flavor: BinaryOperatorFlavor | 'special', lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson): Lang.RBinaryOp {
  parseLog.debug(`[binary op] trying to parse ${flavor} with ${JSON.stringify([lhs, op, rhs])}`)

  ensureChildrenAreLhsAndRhsOrdered(data.config, lhs.content, rhs.content)
  const parsedLhs = tryParseOneElementBasedOnType(data, lhs)
  const parsedRhs = tryParseOneElementBasedOnType(data, rhs)

  if (parsedLhs === undefined || parsedRhs === undefined) {
    throw new XmlParseError(`unexpected under-sided binary op, received ${JSON.stringify([parsedLhs, parsedRhs])} for ${JSON.stringify([lhs, op, rhs])}`)
  }

  const operationName = retrieveOpName(data.config, op)

  const { location, content } = retrieveMetaStructure(data.config, op.content)

  if (flavor === 'special') {
    flavor = identifySpecialOp(content)
  }

  // TODO: assert exists as known operator
  return {
    type:   Lang.Type.BinaryOp,
    flavor,
    location,
    lhs:    parsedLhs,
    rhs:    parsedRhs,
    op:     operationName,
    lexeme: content
  }
}

