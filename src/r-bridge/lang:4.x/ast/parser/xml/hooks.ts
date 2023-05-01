import { NamedXmlBasedJson, XmlBasedJson } from './input-format'
import { RNumber } from '../../model/nodes/RNumber'
import { RLogical } from '../../model/nodes/RLogical'
import { RSymbol } from '../../model/nodes/RSymbol'
import {
  NoInfo,
  RBinaryOp,
  RComment,
  RForLoop,
  RFunctionCall, RIfThenElse,
  RNode,
  RRepeatLoop,
  RUnaryOp,
  RWhileLoop
} from '../../model/model'
import { RNa } from '../../../values'
import { BinaryOperatorFlavor, UnaryOperatorFlavor } from '../../model/operators'
import { ParserData } from './data'

/**
 * Hooks for every action the parser does. They can process the object before and after the actual parsing.
 *
 * There are two main hooks:
 * <ul>
 *   <li><strong>before:</strong> can transform the inputs to the function and is called before construction of the normalized ast. However, it can be called after initial checks are performed. </li>
 *   <li><strong>after:</strong> can transform the result of the function and is called after construction of the normalized ast. </li>
 * </ul>
 * Furthermore, for events that "try" to identify a structure, there is a third hook:
 * <ul>
 *   <li><strong>unknown:</strong> is called if the structure could not be identified. </li>
 * </ul>
 * TODO: allowed processors to return undefined to signal that there is nothing?
 */
export interface ParserHooks {
  values: {
    /** {@link parseNumber} */
    onNumber: {
      before(data: ParserData, inputObj: XmlBasedJson): XmlBasedJson
      after(data: ParserData, result: RNumber | RLogical | RSymbol<NoInfo, typeof RNa>): RNumber | RLogical | RSymbol<NoInfo, typeof RNa>
    },
    /** {@link parseString} */
    onString: {
      before(data: ParserData, inputObj: XmlBasedJson): XmlBasedJson
      after(data: ParserData, result: RSymbol): RSymbol
    },
    /** {@link parseSymbol} */
    onSymbol: {
      before(data: ParserData, inputObjs: XmlBasedJson[]): XmlBasedJson[]
      after(data: ParserData, result: RSymbol | undefined): RSymbol | undefined
    }
  },
  other: {
    /** {@link parseComment} */
    onComment: {
      before(data: ParserData, inputObj: XmlBasedJson): XmlBasedJson
      after(data: ParserData, result: RComment): RComment
    }
  },
  operators: {
    /** {@link tryParseBinaryStructure} */
    onBinary: {
      /** triggered if {@link tryParseBinaryStructure} could not find a matching operator, you probably still want to return `undefined` */
      unknown(data: ParserData, lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson): RNode | undefined
      before(data: ParserData, flavor: BinaryOperatorFlavor | 'special', lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson): {flavor: BinaryOperatorFlavor | 'special', lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson}
      after(data: ParserData, result: RBinaryOp): RBinaryOp
    },
    /** {@link tryParseUnaryStructure} */
    onUnary: {
      /** triggered if {@link tryParseUnaryStructure} could not find a matching operator, you probably still want to return `undefined` */
      unknown(data: ParserData, op: NamedXmlBasedJson, operand: NamedXmlBasedJson): RNode | undefined
      before(data: ParserData, flavor: UnaryOperatorFlavor, op: NamedXmlBasedJson, operand: NamedXmlBasedJson): {flavor: UnaryOperatorFlavor, op: NamedXmlBasedJson, operand: NamedXmlBasedJson}
      after(data: ParserData, result: RUnaryOp): RUnaryOp
    },
  },
  loops: {
    /** {@link tryParseForLoopStructure} */
    onForLoop: {
      /** triggered if {@link tryParseForLoopStructure} could not detect a for-loop, you probably still want to return `undefined` */
      unknown(data: ParserData, forToken: NamedXmlBasedJson, condition: NamedXmlBasedJson, body: NamedXmlBasedJson): RForLoop | undefined
      before(data: ParserData, forToken: NamedXmlBasedJson, condition: NamedXmlBasedJson, body: NamedXmlBasedJson): { forToken: NamedXmlBasedJson, condition: NamedXmlBasedJson, body: NamedXmlBasedJson }
      after(data: ParserData, result: RForLoop): RForLoop
    },
    /** {@link tryParseRepeatLoopStructure} */
    onRepeatLoop: {
      /** triggered if {@link tryParseRepeatLoopStructure} could not detect a repeat-loop, you probably still want to return `undefined` */
      unknown(data: ParserData, repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson): RRepeatLoop | undefined
      before(data: ParserData, repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson): { repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson }
      after(data: ParserData, result: RRepeatLoop): RRepeatLoop
    },
    /** {@link tryParseWhileLoopStructure} */
    onWhileLoop: {
      /** triggered if {@link tryParseWhileLoopStructure} could not detect a while-loop, you probably still want to return `undefined` */
      unknown(data: ParserData, whileToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, body: NamedXmlBasedJson): RWhileLoop | undefined
      before(data: ParserData, whileToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, body: NamedXmlBasedJson): { whileToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, body: NamedXmlBasedJson }
      after(data: ParserData, result: RWhileLoop): RWhileLoop
    }
  },
  functions: {
    /** {@link tryToParseFunctionCall} */
    onFunctionCall: {
      /** triggered if {@link tryToParseFunctionCall} could not detect a function call, you probably still want to return `undefined` */
      unknown(data: ParserData, mappedWithName: NamedXmlBasedJson[]): RFunctionCall | undefined
      before(data: ParserData, mappedWithName: NamedXmlBasedJson[]): NamedXmlBasedJson[]
      after(data: ParserData, result: RFunctionCall): RFunctionCall
    }
  },
  expression: {
    /** {@link parseExpression} */
    onExpression: {
      before(data: ParserData, inputObj: XmlBasedJson): XmlBasedJson
      after(data: ParserData, result: RNode): RNode
    }
  },
  control: {
    /** {@link tryParseIfThenStructure} */
    onIfThen: {
      /** triggered if {@link tryParseIfThenStructure} could not detect a if-then, you probably still want to return `undefined` */
      unknown(data: ParserData, tokens: [
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson
      ]): RIfThenElse | undefined
      before(data: ParserData, tokens: [
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson
      ]): [
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson
      ]
      after(data: ParserData, result: RIfThenElse): RIfThenElse
    },
    /** {@link tryParseIfThenElseStructure} */
    onIfElse: {
      /** triggered if {@link tryParseIfThenElseStructure} could not detect a if-else, you probably still want to return `undefined` */
      unknown(data: ParserData, tokens: [
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson,
        elseToken:  NamedXmlBasedJson,
        elseBlock:  NamedXmlBasedJson
      ]): RIfThenElse | undefined
      before(data: ParserData, tokens: [
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson,
        elseToken:  NamedXmlBasedJson,
        elseBlock:  NamedXmlBasedJson
      ]): [
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson,
        elseToken:  NamedXmlBasedJson,
        elseBlock:  NamedXmlBasedJson
      ]
      after(data: ParserData, result: RIfThenElse): RIfThenElse
    }
  }
}
