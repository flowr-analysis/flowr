import {
  DecoratedAst,
  NodeId,
  ParentInformation,
  RAccess,
  RArgument,
  RBinaryOp,
  RExpressionList,
  RForLoop,
  RFunctionCall,
  RFunctionDefinition,
  RIfThenElse,
  RNode,
  RNodeWithParent,
  RParameter,
  RRepeatLoop,
  RWhileLoop,
  Type,
  RPipe,
  foldAstStateful,
  StatefulFoldFunctions
} from '../r-bridge'
import { log } from '../util/log'
import { guard } from '../util/assert'
import { MergeableRecord } from '../util/objects'
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
const reconstructAsLeaf = (leaf: RNodeWithParent, configuration: ReconstructionConfiguration): Code => {
  const selectionHasLeaf = configuration.selection.has(leaf.info.id) || configuration.autoSelectIf(leaf)
  const wouldBe = foldToConst(leaf)
  reconstructLogger.trace(`reconstructAsLeaf: ${leaf.info.id} (${selectionHasLeaf ? 'y' : 'n'}):  ${JSON.stringify(wouldBe)}`)
  return selectionHasLeaf ? wouldBe : []
}

const foldToConst = (n: RNodeWithParent): Code => plain(getLexeme(n))

function indentBy(lines: Code, indent: number): Code {
  return lines.map(({ line, indent: i }) => ({ line, indent: i + indent }))
}

// TODO: pretty print in down
function reconstructExpressionList(exprList: RExpressionList<ParentInformation>, expressions: Code[], configuration: ReconstructionConfiguration): Code {
  if(isSelected(configuration, exprList)) {
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

function isSelected(configuration: ReconstructionConfiguration, n: RNode<ParentInformation>) {
  return configuration.selection.has(n.info.id) || configuration.autoSelectIf(n)
}

function reconstructRawBinaryOperator(lhs: PrettyPrintLine[], n: string, rhs: PrettyPrintLine[]) {
  return [  // inline pretty print
    ...lhs.slice(0, lhs.length - 1),
    { line: `${lhs[lhs.length - 1].line} ${n} ${rhs[0].line}`, indent: 0 },
    ...indentBy(rhs.slice(1, rhs.length), 1)
  ]
}

function reconstructBinaryOp(n: RBinaryOp<ParentInformation> | RPipe<ParentInformation>, lhs: Code, rhs: Code, configuration: ReconstructionConfiguration): Code {
  if(isSelected(configuration, n)) {
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

  return reconstructRawBinaryOperator(lhs, n.type === Type.Pipe ? '|>' : n.op, rhs)
}

function reconstructForLoop(loop: RForLoop<ParentInformation>, variable: Code, vector: Code, body: Code, configuration: ReconstructionConfiguration): Code {
  if(isSelected(configuration, loop)) {
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
function reconstructRepeatLoop(loop: RRepeatLoop<ParentInformation>, body: Code, configuration: ReconstructionConfiguration): Code {
  if (isSelected(configuration, loop)) {
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

function reconstructIfThenElse(ifThenElse: RIfThenElse<ParentInformation>, condition: Code, when: Code, otherwise: Code | undefined, configuration: ReconstructionConfiguration): Code {
  if (isSelected(configuration, ifThenElse)) {
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
      { line: '} else {', indent: 0 },
      ...indentBy(otherwise, 1),
      { line: '}', indent: 0 }
    ]
  }
}


function reconstructWhileLoop(loop: RWhileLoop<ParentInformation>, condition: Code, body: Code, configuration: ReconstructionConfiguration): Code {
  if(isSelected(configuration, loop)) {
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


function reconstructFoldAccess(node: RAccess<ParentInformation>, accessed: Code, access: string | (Code | null)[], configuration: ReconstructionConfiguration): Code {
  if (isSelected(configuration, node)) {
    return plain(getLexeme(node))
  }
  // TODO: improve
  if (accessed.length === 0) {
    return []
  }

  return plain(getLexeme(node))
}

function reconstructArgument(argument: RArgument<ParentInformation>, name: Code | undefined, value: Code, configuration: ReconstructionConfiguration): Code {
  if(isSelected(configuration, argument)) {
    return plain(getLexeme(argument))
  }

  if(argument.name !== undefined && value.length > 0) {
    return plain(`${getLexeme(argument.name)}=${getLexeme(argument.value)}`)
  } else {
    return value
  }
}

function reconstructFunctionDefinition(definition: RFunctionDefinition<ParentInformation>, _parameters: Code[], body: Code, configuration: ReconstructionConfiguration): Code {
  // if a definition is not selected, we only use the body - slicing will always select the definition
  if(!isSelected(configuration, definition)) {
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
    // unknown -> we add the braces just to be sure
    return [
      { line: `function(${parameters}) {`, indent: 0 },
      ...indentBy(body, 1),
      { line: '}', indent: 0 }
    ]
  }

}


function reconstructSpecialInfixFunctionCall(args: (Code | undefined)[], call: RFunctionCall<ParentInformation>): Code {
  guard(args.length === 2, () => `infix special call must have exactly two arguments, got: ${args.length} (${JSON.stringify(args)})`)
  guard(call.flavour === 'named', `infix special call must be named, got: ${call.flavour}`)
  const lhs = args[0]
  const rhs = args[1]
  if ((lhs === undefined || lhs.length === 0) && (rhs === undefined || rhs.length === 0)) {
    return []
  } /* TODO: else if (lhs === undefined || lhs.length === 0) {
    return rhs as Code
  } */
  // else if (rhs === undefined || rhs.length === 0) {
  // if rhs is undefined we still  have to keep both now, but reconstruct manually :/
  return plain(`${getLexeme(call.arguments[0] as RArgument<ParentInformation>)} ${call.functionName.content} ${getLexeme(call.arguments[1] as RArgument<ParentInformation>)}`)
}

function reconstructFunctionCall(call: RFunctionCall<ParentInformation>, functionName: Code, args: (Code | undefined)[], configuration: ReconstructionConfiguration): Code {
  if(call.infixSpecial === true) {
    return reconstructSpecialInfixFunctionCall(args, call)
  }
  if(isSelected(configuration, call)) {
    return plain(getLexeme(call))
  }
  const filteredArgs = args.filter(a => a !== undefined && a.length > 0)
  if(functionName.length === 0 && filteredArgs.length === 0) {
    return []
  }

  guard(functionName.length <= 1, `can not have multiple lines for the function name, got: ${JSON.stringify(functionName)}`)

  if(args.length === 0) {
    guard(functionName.length === 1, `without args, we need the function name to be present! got: ${JSON.stringify(functionName)}`)
    if(!functionName[0].line.endsWith('()')) {
      // add empty call braces if not present
      functionName[0].line += '()'
    }
    return [{ line: `${functionName[0].line}`, indent: functionName[0].indent }]
  } else {
    return plain(getLexeme(call))
  }
}

type AutoSelectPredicate = (node: RNode<ParentInformation>) => boolean


// TODO: restrict loaded libraries in some way?
interface ReconstructionConfiguration extends MergeableRecord {
  selection:    Selection
  /** if true, this will force the ast part to be reconstructed, this can be used, for example, to force include `library` statements */
  autoSelectIf: AutoSelectPredicate
}

export function doNotAutoSelect(_node: RNode<ParentInformation>): boolean {
  return false
}

const libraryFunctionCall = /^(library|require|((require|load|attach)Namespace))$/
export function autoSelectLibrary(node: RNode<ParentInformation>): boolean {
  if(node.type !== Type.FunctionCall || node.flavour !== 'named') {
    return false
  }
  return libraryFunctionCall.test(node.functionName.content)
}


// escalates with undefined if all are undefined
const reconstructAstFolds: StatefulFoldFunctions<ParentInformation, ReconstructionConfiguration, Code> = {
  // we just pass down the state information so everyone has them
  down:        (_n, c) => c,
  foldNumber:  reconstructAsLeaf,
  foldString:  reconstructAsLeaf,
  foldLogical: reconstructAsLeaf,
  foldSymbol:  reconstructAsLeaf,
  foldAccess:  reconstructFoldAccess,
  binaryOp:    {
    foldLogicalOp:    reconstructBinaryOp,
    foldArithmeticOp: reconstructBinaryOp,
    foldComparisonOp: reconstructBinaryOp,
    foldAssignment:   reconstructBinaryOp,
    foldPipe:         reconstructBinaryOp, /* TODO: check */
    foldModelFormula: reconstructBinaryOp
  },
  unaryOp: {
    foldArithmeticOp: foldToConst,
    foldLogicalOp:    foldToConst,
    foldModelFormula: foldToConst
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

export interface ReconstructionResult {
  code:         string
  /** number of nodes that triggered the `autoSelectIf` predicate {@link reconstructToCode} */
  autoSelected: number
}

/**
 * Reconstructs parts of a normalized R ast into R code on an expression basis.
 *
 * @param ast          - The ast to be used as a basis for reconstruction
 * @param selection    - The selection of nodes to be reconstructed
 * @param autoSelectIf - A predicate that can be used to force the reconstruction of a node (for example to reconstruct library call statements, see {@link autoSelectLibrary}, {@link doNotAutoSelect})
 *
 * @returns Number of times `autoSelectIf` triggered
 */
export function reconstructToCode<Info>(ast: DecoratedAst<Info>, selection: Selection, autoSelectIf: (node: RNode<ParentInformation>) => boolean = autoSelectLibrary): ReconstructionResult {
  reconstructLogger.trace(`reconstruct ast with ids: ${JSON.stringify([...selection])}`)
  let autoSelected = 0
  const autoSelectIfWrapper = (node: RNode<ParentInformation>) => {
    const result = autoSelectIf(node)
    if(result) {
      autoSelected++
    }
    return result
  }
  const result = foldAstStateful(ast.decoratedAst, { selection, autoSelectIf: autoSelectIfWrapper }, reconstructAstFolds)
  reconstructLogger.trace('reconstructed ast before string conversion: ', JSON.stringify(result))
  if(result.length > 1 && result[0].line === '{' && result[result.length - 1].line === '}') {
    // remove outer block
    return { code: prettyPrintCodeToString(indentBy(result.slice(1, result.length - 1), -1)), autoSelected }
  } else {
    return { code: prettyPrintCodeToString(result), autoSelected }
  }
}
