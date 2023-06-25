import {
  DecoratedAst,
  NodeId,
  ParentInformation, RArgument, RBinaryOp,
  RExpressionList,
  RForLoop, RFunctionCall, RFunctionDefinition, RIfThenElse,
  RNodeWithParent, RParameter,
  RRepeatLoop, RWhileLoop
} from '../r-bridge'
import { foldAstStateful, StatefulFoldFunctions } from '../r-bridge/lang:4.x/ast/model/processing/statefulFold'
import { log } from '../util/log'
import { guard } from '../util/assert'
type Selection = Set<NodeId>
interface PrettyPrintLine {
  line:   string
  indent: number
}
function plain(text: string): PrettyPrintLine[] {
  return [{ line: text, indent: 0 }]
}
type Code = PrettyPrintLine[]

export const reconstructLogger = log.getSubLogger({ name: "reconstruct" })


const getLexeme = (n: RNodeWithParent) => n.info.fullLexeme ?? n.lexeme ?? ''
const reconstructAsLeaf = (leaf: RNodeWithParent, selection: Selection): Code => {
  const selectionHasLeaf = selection.has(leaf.info.id)
  const wouldBe = foldToConst(leaf)
  reconstructLogger.trace(`reconstructAsLeaf: ${selectionHasLeaf ? 'y' : 'n'}:  ${JSON.stringify(wouldBe)}`)
  return selectionHasLeaf ? wouldBe : []
}

const foldToConst = (n: RNodeWithParent): Code => plain(getLexeme(n))

function indentBy(lines: Code, indent: number): Code {
  return lines.map(({ line, indent: i }) => ({ line, indent: i + indent }))
}

// TODO: pretty print in down
function reconstructExpressionList(exprList: RExpressionList<ParentInformation>, expressions: Code[], selection: Selection): Code {
  if(selection.has(exprList.info.id)) {
    return plain(getLexeme(exprList))
  }

  const subExpressions = expressions.filter(e => e.length > 0)
  if(subExpressions.length === 0) {
    return []
  } else if(subExpressions.length === 1) {
    return subExpressions[0]
  } else {
    return [
      { line: '{', indent: 0 },
      ...indentBy(subExpressions.flat(), 1),
      { line: '}', indent: 0 }
    ]
  }
}

function reconstructBinaryOp(n: RBinaryOp<ParentInformation>, lhs: Code, rhs: Code, selection: Selection): Code {
  if(selection.has(n.info.id)) {
    return plain(getLexeme(n))
  }

  if(lhs.length === 0 && rhs.length === 0) {
    return []
  }
  if(lhs.length === 0) { // if we have no lhs, only return rhs
    return rhs
  }
  if(rhs.length === 0) { // if we have no rhs we have to keep everything to get the rhs
    return plain(getLexeme(n))
  }

  return [  // inline pretty print
    ...lhs.slice(0, lhs.length - 1),
    { line: `${lhs[lhs.length - 1].line} ${n.op} ${rhs[0].line}`, indent: 0 },
    ...indentBy(rhs.slice(1, rhs.length), 1)
  ]
}

function reconstructForLoop(loop: RForLoop<ParentInformation>, variable: Code, vector: Code, body: Code, selection: Selection): Code {
  if(selection.has(loop.info.id)) {
    return plain(getLexeme(loop))
  }
  if(variable.length === 0 && vector.length === 0) {
    return body
  } else {
    if(body.length <= 1) {
      // 'inline'
      return [{ line: `for(${getLexeme(loop.variable)} in ${getLexeme(loop.vector)}) ${body.length === 0 ? '{}' : body[0].line}`, indent: 0 }]
    } else if (body[0].line === '{' && body[body.length - 1].line === '}') {
      // 'block'
      return [
        { line: `for(${getLexeme(loop.variable)} in ${getLexeme(loop.vector)}) {`, indent: 0 },
        ...body.slice(1, body.length - 1),
        { line: '}', indent: 0 }
      ]
    } else {
      // unknown
      return [
        { line: `for(${getLexeme(loop.variable)} in ${getLexeme(loop.vector)})`, indent: 0 },
        ...indentBy(body, 1)
      ]
    }
  }
}

// TODO: make sure repeat gets auto-selected
// TODO: outsource split
function reconstructRepeatLoop(loop: RRepeatLoop<ParentInformation>, body: Code, selection: Selection): Code {
  if (selection.has(loop.info.id)) {
    return plain(getLexeme(loop))
  } else if (body.length === 0) {
    return []
  } else {
    if(body.length <= 1) {
      // 'inline'
      return [{ line: `repeat ${body.length === 0 ? '{}' : body[0].line}`, indent: 0 }]
    } else if (body[0].line === '{' && body[body.length - 1].line === '}') {
      // 'block'
      return [
        { line: `repeat {`, indent: 0 },
        ...body.slice(1, body.length - 1),
        { line: '}', indent: 0 }
      ]
    } else {
      // unknown
      return [
        { line: `repeat`, indent: 0 },
        ...indentBy(body, 1)
      ]
    }
  }
}

function reconstructIfThenElse(ifThenElse: RIfThenElse<ParentInformation>, condition: Code, when: Code, otherwise: Code | undefined, selection: Selection): Code {
  if (selection.has(ifThenElse.info.id)) {
    return plain(getLexeme(ifThenElse))
  }
  otherwise ??= []
  if(condition.length === 0 && when.length === 0 && otherwise.length === 0) {
    return []
  }
  if(otherwise.length === 0 && when.length === 0) {
    return [
      // TODO: recurse into condition?
      { line: `if(${getLexeme(ifThenElse.condition)}) { }`, indent: 0 }
    ]
  } else if(otherwise.length === 0) {
    return [
      // TODO: recurse into condition?
      { line: `if(${getLexeme(ifThenElse.condition)}) {`, indent: 0 },
      ...indentBy(when, 1),
      { line: '}', indent: 0 }
    ]
  } else if(when.length === 0) {
    return [
      // TODO: recurse into condition?
      { line: `if(${getLexeme(ifThenElse.condition)}) { } else {`, indent: 0 },
      ...indentBy(otherwise, 1),
      { line: '}', indent: 0 }
    ]
  } else {
    return [
      { line: `if(${getLexeme(ifThenElse.condition)}) {`, indent: 0 },
      ...indentBy(when, 1),
      { line: '}', indent: 0 },
      { line: 'else {', indent: 0 },
      ...indentBy(otherwise, 1),
      { line: '}', indent: 0 }
    ]
  }
}


function reconstructWhileLoop(loop: RWhileLoop<ParentInformation>, condition: Code, body: Code, selection: Selection): Code {
  if(selection.has(loop.info.id)) {
    return plain(getLexeme(loop))
  }
  if(condition.length === 0) {
    return body
  } else {
    if(body.length <= 1) {
      // 'inline'
      return [{ line: `while(${getLexeme(loop.condition)}) ${body.length === 0 ? '{}' : body[0].line}`, indent: 0 }]
    } else if (body[0].line === '{' && body[body.length - 1].line === '}') {
      // 'block'
      return [
        { line: `while(${getLexeme(loop.condition)}) {`, indent: 0 },
        ...body.slice(1, body.length - 1),
        { line: '}', indent: 0 }
      ]
    } else {
      // unknown
      return [
        { line: `while(${getLexeme(loop.condition)})`, indent: 0 },
        ...indentBy(body, 1)
      ]
    }
  }
}

function reconstructParameters(parameters: RParameter<ParentInformation>[]): string[] {
  // const baseParameters = parameters.flatMap(p => plain(getLexeme(p)))
  return parameters.map(p => {
    if(p.defaultValue !== undefined) {
      return `${getLexeme(p.name)}=${getLexeme(p.defaultValue)}`
    } else {
      return getLexeme(p)
    }
  })
}

function reconstructArgument(argument: RArgument<ParentInformation>, name: Code | undefined, value: Code, selection: Selection): Code {
  if(selection.has(argument.info.id)) {
    return plain(getLexeme(argument))
  }

  if(argument.name !== undefined) {
    return plain(`${getLexeme(argument.name)}=${getLexeme(argument.value)}`)
  } else {
    return value
  }
}

function reconstructFunctionDefinition(definition: RFunctionDefinition<ParentInformation>, _parameters: Code[], body: Code, selection: Selection): Code {
  // if a definition is not selected, we only use the body - slicing will always select the definition
  if(!selection.has(definition.info.id)) {
    return body
  }
  const parameters = reconstructParameters(definition.parameters).join(', ')
  if(body.length <= 1) {
    // 'inline'
    const bodyStr = body.length === 0 ? '' : `${body[0].line} ` /* add suffix space */
    // we keep the braces in every case because I do not like no-brace functions
    return [{ line: `function(${parameters}) { ${bodyStr}}`, indent: 0 }]
  } else if (body[0].line === '{' && body[body.length - 1].line === '}') {
    // 'block'
    return [
      { line: `function(${parameters}) {`, indent: 0 },
      ...body.slice(1, body.length - 1),
      { line: '}', indent: 0 }
    ]
  } else {
    // unknown
    return [
      { line: `function(${parameters})`, indent: 0 },
      ...indentBy(body, 1)
    ]
  }

}

function reconstructFunctionCall(call: RFunctionCall<ParentInformation>, functionName: Code, args: Code[], selection: Selection): Code {
  if(selection.has(call.info.id)) {
    return plain(getLexeme(call))
  }
  const filteredArgs = args.filter(a => a.length > 0)
  if(functionName.length === 0 && filteredArgs.length === 0) {
    return []
  }

  guard(functionName.length <= 1, `can not have multiple lines for the function name, got: ${JSON.stringify(functionName)}`)

  if(args.length === 0) {
    guard(functionName.length === 1, `without args, we need the function name to be present! got: ${JSON.stringify(functionName)}`)
    guard(functionName[0].line.endsWith('()'), `by default we add '()' to function name on empty calls, but: ${JSON.stringify(functionName)}`)
    return [{ line: `${functionName[0].line}`, indent: functionName[0].indent }]
  } else {
    return plain(getLexeme(call))
  }
}

// escalates with undefined if all are undefined
const reconstructAstFolds: StatefulFoldFunctions<ParentInformation, Selection, Code> = {
  // we just pass down the state information so everyone has them
  down:        (_n, s) => s,
  foldNumber:  reconstructAsLeaf,
  foldString:  reconstructAsLeaf,
  foldLogical: reconstructAsLeaf,
  foldSymbol:  reconstructAsLeaf,
  binaryOp:    {
    foldLogicalOp:    reconstructBinaryOp,
    foldArithmeticOp: reconstructBinaryOp,
    foldComparisonOp: reconstructBinaryOp,
    foldAssignment:   reconstructBinaryOp
  },
  unaryOp: {
    foldArithmeticOp: foldToConst,
    foldLogicalOp:    foldToConst,
  },
  other: {
    foldComment: reconstructAsLeaf
  },
  loop: {
    foldFor:    reconstructForLoop,
    foldRepeat: reconstructRepeatLoop,
    foldWhile:  reconstructWhileLoop,
    foldBreak:  reconstructAsLeaf,
    foldNext:   reconstructAsLeaf
  },
  foldIfThenElse: reconstructIfThenElse,
  foldExprList:   reconstructExpressionList,
  functions:      {
    foldFunctionDefinition: reconstructFunctionDefinition,
    foldFunctionCall:       reconstructFunctionCall,
    foldParameter:          foldToConst,
    foldArgument:           reconstructArgument
  }
}



function getIndentString(indent: number): string {
  return ' '.repeat(indent * 4)
}

function prettyPrintCodeToString(code: Code, lf ='\n'): string {
  return code.map(({ line, indent }) => `${getIndentString(indent)}${line}`).join(lf)
}

/**
 * Reconstructs parts of a normalized R ast into R code on an expression basis.
 */
export function reconstructToCode<Info>(ast: DecoratedAst<Info>, selection: Selection): string {
  reconstructLogger.trace(`reconstruct ast with ids: ${JSON.stringify([...selection])}`)
  const result = foldAstStateful(ast.decoratedAst, selection, reconstructAstFolds)
  reconstructLogger.trace('reconstructed ast before string conversion: ', JSON.stringify(result))
  if(result.length > 1 && result[0].line === '{' && result[result.length - 1].line === '}') {
    // remove outer block
    return prettyPrintCodeToString(indentBy(result.slice(1, result.length - 1), -1))
  } else {
    return prettyPrintCodeToString(result)
  }
}
