import { NamedXmlBasedJson, XmlParseError } from '../../input-format'
import { parseLog } from '../../parser'
import { ensureChildrenAreLhsAndRhsOrdered, retrieveMetaStructure, retrieveOpName } from '../meta'
import { identifySpecialOp } from './special'
import { ParserData } from '../../data'
import { tryParseOneElementBasedOnType } from '../structure'
import {
  ArithmeticOperatorsRAst,
  AssignmentsRAst,
  BinaryOperatorFlavor,
  ComparisonOperatorsRAst,
  LogicalOperatorsRAst,
  ModelFormulaOperatorsRAst,
  RBinaryOp,
  RNode,
  RPipe,
  RSymbol,
  Type
} from '../../../../model'
import { executeHook, executeUnknownHook } from '../../hooks'
import { guard } from '../../../../../../../util/assert'

/**
 * Parsing binary operations includes the pipe, even though the produced PIPE construct is not a binary operation,
 * to ensure it is handled separately from the others (especially in the combination of a pipe bind)
 */
export function tryParseBinaryOperation(
  data: ParserData,
  lhs: NamedXmlBasedJson,
  op: NamedXmlBasedJson,
  rhs: NamedXmlBasedJson
): RNode | undefined {
  parseLog.trace(`binary op for ${lhs.name} [${op.name}] ${rhs.name}`)
  let flavor: BinaryOperatorFlavor | 'special' | 'pipe'
  if (Type.Special === op.name) {
    flavor = "special"
  } else if (ArithmeticOperatorsRAst.has(op.name)) {
    flavor = "arithmetic"
  } else if (ComparisonOperatorsRAst.has(op.name)) {
    flavor = "comparison"
  } else if (LogicalOperatorsRAst.has(op.name)) {
    flavor = "logical"
  }  else if (ModelFormulaOperatorsRAst.has(op.name)) {
    flavor = "model formula"
  } else if (AssignmentsRAst.has(op.name)) {
    flavor = "assignment"
  } else if(op.name === Type.Pipe) {
    flavor = 'pipe'
  } else {
    return executeUnknownHook(data.hooks.operators.onBinary.unknown, data, { lhs, op, rhs })
  }
  // TODO: identify op name correctly
  return parseBinaryOp(data, flavor, lhs, op, rhs)
}

function parseBinaryOp(data: ParserData, flavor: BinaryOperatorFlavor | 'special' | 'pipe', lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson): RBinaryOp | RPipe {
  parseLog.debug(`[binary op] trying to parse ${flavor}`);
  ({ flavor, lhs, rhs, op} = executeHook(data.hooks.operators.onBinary.before, data, { flavor, lhs, op, rhs }))

  ensureChildrenAreLhsAndRhsOrdered(data.config, lhs.content, rhs.content)
  let parsedLhs = tryParseOneElementBasedOnType(data, lhs)
  let parsedRhs = tryParseOneElementBasedOnType(data, rhs)

  if (parsedLhs === undefined || parsedRhs === undefined) {
    throw new XmlParseError(`unexpected under-sided binary op, received ${JSON.stringify([parsedLhs, parsedRhs])} for ${JSON.stringify([lhs, op, rhs])}`)
  }

  const operationName = retrieveOpName(data.config, op)

  // special support for strings in assignments
  if(flavor === 'assignment') {
    [parsedLhs, parsedRhs] = processLhsAndRhsForAssignment(data, operationName, parsedLhs, parsedRhs)
  }



  const { location, content } = retrieveMetaStructure(data.config, op.content)

  if (flavor === 'special') {
    flavor = identifySpecialOp(content)
  }

  // TODO: assert exists as known operator
  let result: RBinaryOp | RPipe
  if(flavor === 'pipe') {
    guard(parsedLhs.location !== undefined, () => `pipe lhs must have a location, but ${JSON.stringify(parsedLhs)})`)
    guard(parsedLhs.lexeme !== undefined, () => `pipe lhs must have a full lexeme, but ${JSON.stringify(parsedLhs)})`)
    result = {
      type: Type.Pipe,
      location,
      lhs:  {
        type:     Type.Argument,
        location: parsedLhs.location,
        value:    parsedLhs,
        name:     undefined,
        lexeme:   parsedLhs.lexeme,
        info:     {}
      },
      rhs:    parsedRhs,
      lexeme: content,
      info:   {
        // TODO: include lhs and rhs
        fullRange:        data.currentRange,
        additionalTokens: [],
        fullLexeme:       data.currentLexeme
      }
    }
  } else {
    result = {
      type:   Type.BinaryOp,
      flavor,
      location,
      lhs:    parsedLhs,
      rhs:    parsedRhs,
      op:     operationName,
      lexeme: content,
      info:   {
        // TODO: include lhs and rhs
        fullRange:        data.currentRange,
        additionalTokens: [],
        fullLexeme:       data.currentLexeme
      }
    }
  }
  return executeHook(data.hooks.operators.onBinary.after, data, result)
}

function processLhsAndRhsForAssignment(data: ParserData, opName: string, parsedLhs: RNode, parsedRhs: RNode): [RNode, RNode] {
  const isRhs = opName === '->' || opName === '->>'
  const assigned = isRhs ? parsedRhs : parsedLhs
  if(assigned.type !== Type.String) {
    return [parsedLhs, parsedRhs]
  }

  // update the assigned value to be parsed as a symbol
  const result: RSymbol = {
    type:      Type.Symbol,
    lexeme:    assigned.lexeme,
    location:  assigned.location,
    content:   assigned.content.str,
    namespace: undefined,
    info:      assigned.info
  }
  return isRhs ? [parsedLhs, result] : [result, parsedRhs]
}

