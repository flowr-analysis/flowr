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
import { DeepReadonly, DeepRequired } from 'ts-essentials'

/** Denotes that if you return `undefined`, the parser will automatically take the original arguments (unchanged) */
type AutoIfOmit<T> = T | undefined

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
 *
 * For those marked with {@link AutoIfOmit} you can return `undefined` to automatically take the original arguments (unchanged).
 */
export interface XmlParserHooks {
  values: {
    /** {@link parseNumber} */
    onNumber: {
      before(data: ParserData, inputObj: XmlBasedJson): AutoIfOmit<XmlBasedJson>
      after(data: ParserData, result: RNumber | RLogical | RSymbol<NoInfo, typeof RNa>): AutoIfOmit<RNumber | RLogical | RSymbol<NoInfo, typeof RNa>>
    },
    /** {@link parseString} */
    onString: {
      before(data: ParserData, inputObj: XmlBasedJson): AutoIfOmit<XmlBasedJson>
      after(data: ParserData, result: RSymbol): AutoIfOmit<RSymbol>
    },
    /** {@link parseSymbol} */
    onSymbol: {
      before(data: ParserData, inputObjs: XmlBasedJson[]): AutoIfOmit<XmlBasedJson[]>
      after(data: ParserData, result: RSymbol | undefined): AutoIfOmit<RSymbol | undefined>
    }
  },
  other: {
    /** {@link parseComment} */
    onComment: {
      before(data: ParserData, inputObj: XmlBasedJson): AutoIfOmit<XmlBasedJson>
      after(data: ParserData, result: RComment): AutoIfOmit<RComment>
    }
  },
  operators: {
    /** {@link tryParseBinaryStructure} */
    onBinary: {
      /** triggered if {@link tryParseBinaryStructure} could not find a matching operator, you probably still want to return `undefined` */
      unknown(data: ParserData, lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson): AutoIfOmit<RNode | undefined>
      before(data: ParserData, flavor: BinaryOperatorFlavor | 'special', lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson): AutoIfOmit<{flavor: BinaryOperatorFlavor | 'special', lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson}>
      after(data: ParserData, result: RBinaryOp): AutoIfOmit<RBinaryOp>
    },
    /** {@link tryParseUnaryStructure} */
    onUnary: {
      /** triggered if {@link tryParseUnaryStructure} could not find a matching operator, you probably still want to return `undefined` */
      unknown(data: ParserData, op: NamedXmlBasedJson, operand: NamedXmlBasedJson): AutoIfOmit<RNode | undefined>
      before(data: ParserData, flavor: UnaryOperatorFlavor, op: NamedXmlBasedJson, operand: NamedXmlBasedJson): AutoIfOmit<{flavor: UnaryOperatorFlavor, op: NamedXmlBasedJson, operand: NamedXmlBasedJson}>
      after(data: ParserData, result: RUnaryOp): AutoIfOmit<RUnaryOp>
    },
  },
  loops: {
    /** {@link tryParseForLoopStructure} */
    onForLoop: {
      /** triggered if {@link tryParseForLoopStructure} could not detect a for-loop, you probably still want to return `undefined` */
      unknown(data: ParserData, forToken: NamedXmlBasedJson, condition: NamedXmlBasedJson, body: NamedXmlBasedJson): AutoIfOmit<RForLoop | undefined>
      before(data: ParserData, forToken: NamedXmlBasedJson, condition: NamedXmlBasedJson, body: NamedXmlBasedJson): AutoIfOmit<{ forToken: NamedXmlBasedJson, condition: NamedXmlBasedJson, body: NamedXmlBasedJson }>
      after(data: ParserData, result: RForLoop): AutoIfOmit<RForLoop>
    },
    /** {@link tryParseRepeatLoopStructure} */
    onRepeatLoop: {
      /** triggered if {@link tryParseRepeatLoopStructure} could not detect a repeat-loop, you probably still want to return `undefined` */
      unknown(data: ParserData, repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson): AutoIfOmit<RRepeatLoop | undefined>
      before(data: ParserData, repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson): AutoIfOmit<{ repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson }>
      after(data: ParserData, result: RRepeatLoop): AutoIfOmit<RRepeatLoop>
    },
    /** {@link tryParseWhileLoopStructure} */
    onWhileLoop: {
      /** triggered if {@link tryParseWhileLoopStructure} could not detect a while-loop, you probably still want to return `undefined` */
      unknown(data: ParserData, whileToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, body: NamedXmlBasedJson): AutoIfOmit<RWhileLoop | undefined>
      before(data: ParserData, whileToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, body: NamedXmlBasedJson): AutoIfOmit<{ whileToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, body: NamedXmlBasedJson }>
      after(data: ParserData, result: RWhileLoop): AutoIfOmit<RWhileLoop>
    }
  },
  functions: {
    /** {@link tryToParseFunctionCall} */
    onFunctionCall: {
      /** triggered if {@link tryToParseFunctionCall} could not detect a function call, you probably still want to return `undefined` */
      unknown(data: ParserData, mappedWithName: NamedXmlBasedJson[]): AutoIfOmit<RFunctionCall | undefined>
      before(data: ParserData, mappedWithName: NamedXmlBasedJson[]): AutoIfOmit<NamedXmlBasedJson[]>
      after(data: ParserData, result: RFunctionCall): AutoIfOmit<RFunctionCall>
    }
  },
  expression: {
    /** {@link parseExpression} */
    onExpression: {
      before(data: ParserData, inputObj: XmlBasedJson): AutoIfOmit<XmlBasedJson>
      after(data: ParserData, result: RNode): AutoIfOmit<RNode>
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
      ]): AutoIfOmit<RIfThenElse | undefined>
      before(data: ParserData, tokens: [
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson
      ]): AutoIfOmit<[
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson
      ]>
      after(data: ParserData, result: RIfThenElse): AutoIfOmit<RIfThenElse>
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
      ]): AutoIfOmit<RIfThenElse | undefined>
      before(data: ParserData, tokens: [
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson,
        elseToken:  NamedXmlBasedJson,
        elseBlock:  NamedXmlBasedJson
      ]): AutoIfOmit<[
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson,
        elseToken:  NamedXmlBasedJson,
        elseBlock:  NamedXmlBasedJson
      ]>
      after(data: ParserData, result: RIfThenElse): AutoIfOmit<RIfThenElse>
    }
  }
}

function doNothing() { return undefined }

export const DEFAULT_PARSER_HOOKS: DeepReadonly<DeepRequired<XmlParserHooks>> = {
  values: {
    onNumber: {
      before: doNothing,
      after:  doNothing
    },
    onString: {
      before: doNothing,
      after:  doNothing
    },
    onSymbol: {
      before: doNothing,
      after:  doNothing
    }
  },
  other: {
    onComment: {
      before: doNothing,
      after:  doNothing
    }
  },
  control: {
    onIfThen: {
      unknown: doNothing,
      before:  doNothing,
      after:   doNothing
    },
    onIfElse: {
      unknown: doNothing,
      before:  doNothing,
      after:   doNothing
    }
  },
  loops: {
    onForLoop: {
      unknown: doNothing,
      before:  doNothing,
      after:   doNothing
    },
    onRepeatLoop: {
      unknown: doNothing,
      before:  doNothing,
      after:   doNothing
    },
    onWhileLoop: {
      unknown: doNothing,
      before:  doNothing,
      after:   doNothing
    }
  },
  operators: {
    onBinary: {
      unknown: doNothing,
      before:  doNothing,
      after:   doNothing
    },
    onUnary: {
      unknown: doNothing,
      before:  doNothing,
      after:   doNothing
    }
  },
  functions: {
    onFunctionCall: {
      unknown: doNothing,
      before:  doNothing,
      after:   doNothing
    }
  },
  expression: {
    onExpression: {
      before: doNothing,
      after:  doNothing
    }
  }
} as const
