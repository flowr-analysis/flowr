import { NamedXmlBasedJson, XmlBasedJson } from './input-format'
import {
  RNumber,
  NoInfo,
  RBinaryOp,
  RComment,
  RForLoop,
  RFunctionCall,
  RIfThenElse,
  RNode,
  RRepeatLoop,
  RString,
  RUnaryOp,
  RWhileLoop,
  RSymbol,
  RLogical,
  BinaryOperatorFlavor,
  UnaryOperatorFlavor, RBreak, RNext
} from '../../model'
import { RNa } from '../../../values'
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
 * <p>
 * Use {@link executeHook} and {@link executeUnknownHook} to execute the hooks.
 * <p>
 * Please note, that there is no guarantee, that a hook is not using any other. For example, {@link tryParseIfThenStructure} is used by {@link tryParseIfThenElseStructure}.
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
      after(data: ParserData, result: RString): AutoIfOmit<RString>
    },
    /** {@link tryParseSymbol} */
    onSymbol: {
      /**
       * triggered if {@link tryParseSymbol} could not determine the namespace and or symbol.
       * Can emit non-symbol values easily due to special symbols like `T`.
       */
      unknown(data: ParserData, inputObjs: NamedXmlBasedJson[]): AutoIfOmit<RNode | undefined>
      before(data: ParserData, inputObjs: NamedXmlBasedJson[]): AutoIfOmit<NamedXmlBasedJson[]>
      after(data: ParserData, result: RNode | undefined): AutoIfOmit<RNode | undefined>
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
      unknown(data: ParserData, input: { lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson }): AutoIfOmit<RNode | undefined>
      before(data: ParserData, input: { flavor: BinaryOperatorFlavor | 'special', lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson }): AutoIfOmit<{flavor: BinaryOperatorFlavor | 'special', lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson}>
      after(data: ParserData, result: RBinaryOp): AutoIfOmit<RBinaryOp>
    },
    /** {@link tryParseUnaryStructure} */
    onUnary: {
      /** triggered if {@link tryParseUnaryStructure} could not find a matching operator, you probably still want to return `undefined` */
      unknown(data: ParserData, input: { op: NamedXmlBasedJson, operand: NamedXmlBasedJson } ): AutoIfOmit<RNode | undefined>
      before(data: ParserData, input: { flavor: UnaryOperatorFlavor, op: NamedXmlBasedJson, operand: NamedXmlBasedJson }): AutoIfOmit<{flavor: UnaryOperatorFlavor, op: NamedXmlBasedJson, operand: NamedXmlBasedJson}>
      after(data: ParserData, result: RUnaryOp): AutoIfOmit<RUnaryOp>
    },
  },
  loops: {
    /** {@link tryParseForLoopStructure} */
    onForLoop: {
      /** triggered if {@link tryParseForLoopStructure} could not detect a for-loop, you probably still want to return `undefined` */
      unknown(data: ParserData, input: { forToken: NamedXmlBasedJson, condition: NamedXmlBasedJson, body: NamedXmlBasedJson }): AutoIfOmit<RForLoop | undefined>
      before(data: ParserData, input: { forToken: NamedXmlBasedJson, condition: NamedXmlBasedJson, body: NamedXmlBasedJson }): AutoIfOmit<{ forToken: NamedXmlBasedJson, condition: NamedXmlBasedJson, body: NamedXmlBasedJson }>
      after(data: ParserData, result: RForLoop): AutoIfOmit<RForLoop>
    },
    /** {@link tryParseRepeatLoopStructure} */
    onRepeatLoop: {
      /** triggered if {@link tryParseRepeatLoopStructure} could not detect a repeat-loop, you probably still want to return `undefined` */
      unknown(data: ParserData, input: { repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson }): AutoIfOmit<RRepeatLoop | undefined>
      before(data: ParserData, input: { repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson }): AutoIfOmit<{ repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson }>
      after(data: ParserData, result: RRepeatLoop): AutoIfOmit<RRepeatLoop>
    },
    /** {@link tryParseWhileLoopStructure} */
    onWhileLoop: {
      /** triggered if {@link tryParseWhileLoopStructure} could not detect a while-loop, you probably still want to return `undefined` */
      unknown(data: ParserData, input: { whileToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, body: NamedXmlBasedJson }): AutoIfOmit<RWhileLoop | undefined>
      before(data: ParserData, input: { whileToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, body: NamedXmlBasedJson }): AutoIfOmit<{ whileToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, body: NamedXmlBasedJson }>
      after(data: ParserData, result: RWhileLoop): AutoIfOmit<RWhileLoop>
    }
    /** {@link parseBreak} */
    onBreak: {
      before (data: ParserData, input: XmlBasedJson): AutoIfOmit<XmlBasedJson>
      after (data: ParserData, result: RBreak): AutoIfOmit<RBreak>
    },
    onNext: {
      before (data: ParserData, input: XmlBasedJson): AutoIfOmit<XmlBasedJson>
      after (data: ParserData, result: RNext): AutoIfOmit<RNext>
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
      /** can be a function as well, is not known when issuing before! */
      before(data: ParserData, inputObj: XmlBasedJson): AutoIfOmit<XmlBasedJson>
      after(data: ParserData, result: RNode): AutoIfOmit<RNode>
    }
  },
  control: {
    /** {@link tryParseIfThenStructure}, triggered by {@link onIfThenElse} as well */
    onIfThen: {
      /** triggered if {@link tryParseIfThenStructure} could not detect an if-then, you probably still want to return `undefined` */
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
    /** {@link tryParseIfThenElseStructure}, triggers {@link onIfThen} */
    onIfThenElse: {
      /** triggered if {@link tryParseIfThenElseStructure} could not detect an if-then-else, you probably still want to return `undefined`, this is probably called as a consequence of the unknown hook of if-then */
      unknown(data: ParserData, tokens: [
        ifToken:    NamedXmlBasedJson,
        leftParen:  NamedXmlBasedJson,
        condition:  NamedXmlBasedJson,
        rightParen: NamedXmlBasedJson,
        then:       NamedXmlBasedJson,
        elseToken:  NamedXmlBasedJson,
        elseBlock:  NamedXmlBasedJson
      ]): AutoIfOmit<RIfThenElse | undefined>
      /** be aware, that the if-then part triggers another hook! */
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

/* eslint-disable */
/**
 * simple (rather type-wise unsafe ^^) function you can use to execute hooks and deal with {@link AutoIfOmit}
 *
 * @see executeUnknownHook
 */
export function executeHook<T, R>(hook: (data: ParserData, input: T) => AutoIfOmit<R>, data: ParserData, input: T): R {
  const result = hook(data, input)
  if (result === undefined) {
    return input as unknown as R
  }
  return result
}

/**
 * @see executeHook
 */
export function executeUnknownHook<T, R>(hook: (data: ParserData, input: T) => AutoIfOmit<R>, data: ParserData, input: T): AutoIfOmit<R> {
  return hook(data, input)
}
// TODO: on unknown keep returning undefined!
/* eslint-enable */

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
      unknown: doNothing,
      before:  doNothing,
      after:   doNothing
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
    onIfThenElse: {
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
    },
    onBreak: {
      before: doNothing,
      after:  doNothing
    },
    onNext: {
      before: doNothing,
      after:  doNothing
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
