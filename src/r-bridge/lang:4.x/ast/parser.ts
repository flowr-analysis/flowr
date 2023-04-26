import { deepMergeObject, type MergeableRecord } from '../../../util/objects'
import * as xml2js from 'xml2js'
import * as Lang from './model'
import {
  compareRanges,
  type NoInfo,
  type OperatorFlavor,
  rangeFrom, RForLoop,
  type RIfThenElse,
  type RNode,
  type RSymbol
} from './model'
import { log } from '../../../util/log'
import { boolean2ts, isBoolean, isNA, number2ts, type RNa, string2ts } from '../values'
import { guard } from "../../../util/assert"

const parseLog = log.getSubLogger({ name: 'ast-parser' })

interface AstParser<Target extends Lang.Base<NoInfo, string | undefined>> {
  parse: (xmlString: string) => Promise<Target>
}

interface XmlParserConfig extends MergeableRecord {
  attributeName: string
  contentName:   string
  childrenName:  string
  // Mapping from xml tag name to the real operation of the node
  tokenMap?:     Record<string, string /* TODO: change this to OP enum or so */>
}

const DEFAULT_XML_PARSER_CONFIG: XmlParserConfig = {
  attributeName: '@attributes',
  contentName:   '@content',
  childrenName:  '@children'
}

class XmlParseError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'XmlParseError'
  }
}

type XmlBasedJson = Record<string, any>

interface NamedXmlBasedJson {
  name:    string,
  content: XmlBasedJson
}

function getKeysGuarded (obj: XmlBasedJson, key: string): any
function getKeysGuarded (obj: XmlBasedJson, ...key: string[]): Record<string, any>
function getKeysGuarded (obj: XmlBasedJson, ...key: string[]): (Record<string, any> | string) {
  const keys = Object.keys(obj)

  const check = (key: string): any => {
    if (!keys.includes(key)) {
      throw new XmlParseError(`expected obj to have key ${key}, yet received ${JSON.stringify(obj)}`)
    }
    return obj[key]
  }

  if (key.length === 1) {
    return check(key[0])
  } else {
    return key.reduce<Record<string, any>>((acc, key) => {
      acc[key] = check(key)
      return acc
    }, {})
  }
}

function extractRange (ast: XmlBasedJson): Lang.Range {
  const {
    line1,
    col1,
    line2,
    col2
  } = getKeysGuarded(ast, 'line1', 'col1', 'line2', 'col2')
  return rangeFrom(line1, col1, line2, col2)
}

function identifySpecialOp (content: string, lhs: RNode, rhs: RNode): OperatorFlavor {
  if (Lang.ComparisonOperatorsRAst.includes(content)) {
    return 'comparison'
  } else if (Lang.LogicalOperatorsRAst.includes(content)) {
    return 'logical'
  } else {
    // TODO: others?
    return 'arithmetic'
  }
}

class XmlBasedAstParser implements AstParser<Lang.RNode> {
  private objectRoot:      undefined | XmlBasedJson
  private readonly config: XmlParserConfig

  constructor (config?: Partial<XmlParserConfig>) {
    this.config = deepMergeObject(DEFAULT_XML_PARSER_CONFIG, config)
    parseLog.debug(`config for xml parser: ${JSON.stringify(this.config)}`)
  }

  public async parse (xmlString: string): Promise<Lang.RExpressionList> {
    this.objectRoot = await this.parseToObj(xmlString) as XmlBasedJson

    return this.parseRootObjToAst(this.objectRoot)
  }

  public parseBinaryOp (flavor: OperatorFlavor | 'special', lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson): Lang.RBinaryOp {
    parseLog.debug(`trying to parse ${flavor} op as binary op ${JSON.stringify([lhs, op, rhs])}`)

    this.ensureChildrenAreLhsAndRhsOrdered(lhs.content, rhs.content)
    const parsedLhs = this.parseOneElementBasedOnType(lhs)
    const parsedRhs = this.parseOneElementBasedOnType(rhs)

    if (parsedLhs === undefined || parsedRhs === undefined) {
      throw new XmlParseError(`unexpected under-sided binary op, received ${JSON.stringify([parsedLhs, parsedRhs])} for ${JSON.stringify([lhs, op, rhs])}`)
    }

    const operationName = this.retrieveOpName(op)

    const {
      location,
      content
    } = this.retrieveMetaStructure(op.content)

    if (flavor === 'special') {
      flavor = identifySpecialOp(content, parsedLhs, parsedRhs)
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

  private async parseToObj (xmlString: string): Promise<object> {
    return await xml2js.parseStringPromise(xmlString, {
      attrkey:               this.config.attributeName,
      charkey:               this.config.contentName,
      childkey:              this.config.childrenName,
      charsAsChildren:       false,
      explicitChildren:      true,
      // we need this for semicolons etc., while we keep the old broken components we ignore them completely
      preserveChildrenOrder: true,
      normalize:             true,
      strict:                true
    })
  }

  private parseRootObjToAst (obj: XmlBasedJson): Lang.RExpressionList {
    const exprContent = getKeysGuarded(obj, Lang.Type.ExpressionList)
    this.assureName(exprContent, Lang.Type.ExpressionList)

    const children = getKeysGuarded(exprContent, this.config.childrenName)
    const parsedChildren = this.parseBasedOnType(children)

    // TODO: at total object in any case of error?
    return {
      type:     Lang.Type.ExpressionList,
      children: parsedChildren,
      lexeme:   undefined
    }
  }

  private revertTokenReplacement (token: string): string {
    const result = this.config.tokenMap?.[token] ?? token
    parseLog.debug(`reverting ${token}=>${result}`)
    return result
  }

  private parseBasedOnType (obj: XmlBasedJson[]): Lang.RNode[] {
    if (obj.length === 0) {
      log.warn('no children received, skipping')
      return []
    }

    const mappedWithName: NamedXmlBasedJson[] = obj.map((content) => ({
      name: this.getName(content),
      content
    }))

    // TODO: some more performant way, so that when redoing this recursively we don't have to extract names etc again
    // mappedWithName.

    // TODO: improve with error message and ensure no semicolon
    if (mappedWithName.length === 1) {
      const parsed = this.parseOneElementBasedOnType(mappedWithName[0])
      return parsed === undefined ? [] : [parsed]
    } else if (mappedWithName.length === 3) { /* TODO: unary ops for == 2 */
      const binary = this.parseBinaryStructure(mappedWithName[0], mappedWithName[1], mappedWithName[2])
      if (binary !== 'no binary structure') {
        return [binary]
      } else {
        // TODO: maybe-monad passthrough? or just use undefined
        const forLoop = this.parseForLoopStructure(mappedWithName[0], mappedWithName[1], mappedWithName[2])
        if (forLoop !== 'no for-loop') {
          return [forLoop]
        }
      }
    } else if (mappedWithName.length === 5) {
      const ifThen = this.parseIfThenStructure(mappedWithName[0], mappedWithName[1], mappedWithName[2], mappedWithName[3], mappedWithName[4])
      if (ifThen !== 'no if-then') {
        return [ifThen]
      }
    } else if (mappedWithName.length === 7) {
      const ifThenElse = this.parseIfThenElseStructure(mappedWithName[0], mappedWithName[1], mappedWithName[2], mappedWithName[3], mappedWithName[4], mappedWithName[5], mappedWithName[6])
      if (ifThenElse !== 'no if-then-else') {
        return [ifThenElse]
      }
    }

    // otherwise perform default parsing
    const parsedNodes = this.parseNodesWithUnknownType(mappedWithName)
    return parsedNodes
  }

  private parseNodesWithUnknownType (mappedWithName: NamedXmlBasedJson[]) {
    const parsedNodes: Lang.RNode[] = []
    // used to indicate the new root node of this set of nodes
    // TODO: refactor?
    // TODO: allow to configure #name
    for (const elem of mappedWithName) {
      const retrieved = this.parseOneElementBasedOnType(elem)
      if (retrieved !== undefined) {
        parsedNodes.push(retrieved)
      }
    }
    return parsedNodes
  }

  /**
   * parses a single structure in the ast based on its type
   *
   * @return nothing if no parse result is to be produced (i.e., if it is skipped)
   */
  private parseOneElementBasedOnType (elem: NamedXmlBasedJson): Lang.RNode | undefined {
    switch (elem.name) {
      case Lang.Type.ParenLeft:
      case Lang.Type.ParenRight:
        log.debug(`skipping parenthesis information for ${JSON.stringify(elem)}`)
        return undefined
      case Lang.Type.BraceLeft:
      case Lang.Type.BraceRight:
        log.debug(`skipping brace information for ${JSON.stringify(elem)}`)
        return undefined
      case Lang.Type.Comment:
        log.debug(`skipping comment information for ${JSON.stringify(elem)}`)
        return undefined
      case Lang.Type.Expression:
      case Lang.Type.ExprHelpAssignWrapper:
        return this.parseExpr(elem.content)
      case Lang.Type.Number:
        return this.parseNumber(elem.content)
      case Lang.Type.String:
        return this.parseString(elem.content)
      case Lang.Type.Symbol:
        return this.parseSymbol(elem.content)
      case Lang.Type.Null:
        return this.parseSymbol(elem.content)
      default:
        throw new XmlParseError(`unknown type ${elem.name}`)
    }
  }

  private parseBinaryStructure (lhs: NamedXmlBasedJson, op: NamedXmlBasedJson, rhs: NamedXmlBasedJson): Lang.RNode | 'no binary structure' {
    parseLog.trace(`binary op for ${lhs.name} [${op.name}] ${rhs.name}`)
    let flavor: OperatorFlavor | 'special'
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
      return 'no binary structure'
    }
    // TODO: identify op name correctly
    return this.parseBinaryOp(flavor, lhs, op, rhs)
  }

  private parseForLoopStructure (forToken: NamedXmlBasedJson, condition: NamedXmlBasedJson, body: NamedXmlBasedJson): RForLoop | 'no for-loop' {
    // funny, for does not use top-level parenthesis
    if (forToken.name !== Lang.Type.For) {
      log.debug('encountered non-for token for supposed for-loop structure')
      return 'no for-loop'
    } else if (condition.name !== Lang.Type.ForCondition) {
      throw new XmlParseError(`expected condition for for-loop but found ${JSON.stringify(condition)}`)
    } else if (body.name !== Lang.Type.Expression) {
      throw new XmlParseError(`expected expr body for for-loop but found ${JSON.stringify(body)}`)
    }

    parseLog.debug(`trying to parse for-loop with ${JSON.stringify([forToken, condition, body])}`)

    const { variable: parsedVariable, vector: parsedVector } = this.parseForLoopCondition(condition.content)
    const parseBody = this.parseOneElementBasedOnType(body)

    if (parsedVariable === undefined || parsedVector === undefined || parseBody === undefined) {
      throw new XmlParseError(`unexpected under-sided for-loop, received ${JSON.stringify([parsedVariable, parsedVariable, parseBody])} for ${JSON.stringify([forToken, condition, body])}`)
    }

    const {
      location,
      content
    } = this.retrieveMetaStructure(forToken.content)

    // TODO: assert exists as known operator
    return {
      type:     Lang.Type.For,
      variable: parsedVariable,
      vector:   parsedVector,
      body:     parseBody,
      lexeme:   content,
      location
    }
  }

  private parseForLoopCondition(forCondition: XmlBasedJson): { variable: RSymbol | undefined, vector: RNode | undefined } {
    // must have a child which is `in`, a variable on the left, and a vector on the right
    const children: NamedXmlBasedJson[] = getKeysGuarded(forCondition, this.config.childrenName).map((content: XmlBasedJson) => ({
      name: this.getName(content),
      content
    }))
    const inPosition = children.findIndex(elem => elem.name === Lang.Type.ForIn)
    guard(inPosition > 0 && inPosition < children.length - 1, `for loop searched in and found at ${inPosition}, but this is not in legal bounds for ${JSON.stringify(children)}`)
    const variable = this.parseSymbol(children[inPosition - 1].content)
    // TODO: just parse single element directly
    const vector = this.parseBasedOnType([children[inPosition + 1].content])
    guard(vector.length === 1, `for loop vector should have been parsed to a single element but was ${JSON.stringify(vector)}`)

    return { variable, vector: vector[0] }
  }

  private parseIfThenStructure (ifToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, then: NamedXmlBasedJson): RIfThenElse | 'no if-then' {
    // TODO: guard-like syntax for this too?
    if (ifToken.name !== Lang.Type.If) {
      log.debug('encountered non-if token for supposed if-then structure')
      return 'no if-then'
    } else if (leftParen.name !== Lang.Type.ParenLeft) {
      throw new XmlParseError(`expected left-parenthesis for if but found ${JSON.stringify(leftParen)}`)
    } else if (rightParen.name !== Lang.Type.ParenRight) {
      throw new XmlParseError(`expected right-parenthesis for if but found ${JSON.stringify(rightParen)}`)
    }

    const parsedCondition = this.parseOneElementBasedOnType(condition)
    const parsedThen = this.parseOneElementBasedOnType(then)

    const {
      location,
      content
    } = this.retrieveMetaStructure(ifToken.content)

    if (parsedCondition === undefined || parsedThen === undefined) {
      throw new XmlParseError(`unexpected missing parts of if, received ${JSON.stringify([parsedCondition, parsedThen])} for ${JSON.stringify([ifToken, condition, then])}`)
    }

    return {
      type:      Lang.Type.If,
      condition: parsedCondition,
      then:      parsedThen,
      location,
      lexeme:    content
    }
  }

  private parseIfThenElseStructure (ifToken: NamedXmlBasedJson, leftParen: NamedXmlBasedJson, condition: NamedXmlBasedJson, rightParen: NamedXmlBasedJson, then: NamedXmlBasedJson, elseToken: NamedXmlBasedJson, elseBlock: NamedXmlBasedJson): RIfThenElse | 'no if-then-else' {
    // we start by parsing a regular if-then structure
    log.trace(`trying to parse if-then-else structure for ${JSON.stringify([ifToken, leftParen, condition, rightParen, then, elseToken, elseBlock])}`)
    const parsedIfThen = this.parseIfThenStructure(ifToken, leftParen, condition, rightParen, then)
    if (parsedIfThen === 'no if-then') {
      return 'no if-then-else'
    }
    log.trace(`if-then part successful, now parsing else part for ${JSON.stringify([elseToken, elseBlock])}`)
    if (elseToken.name !== Lang.Type.Else) {
      throw new XmlParseError(`expected right-parenthesis for if but found ${JSON.stringify(rightParen)}`)
    }
    const parsedElse = this.parseOneElementBasedOnType(elseBlock)
    if (parsedElse === undefined) {
      throw new XmlParseError(`unexpected missing else-part of if-then-else, received ${JSON.stringify([parsedIfThen, parsedElse])} for ${JSON.stringify([ifToken, condition, then, elseToken, elseBlock])}`)
    }
    return {
      ...parsedIfThen,
      otherwise: parsedElse
    }
  }

  private ensureChildrenAreLhsAndRhsOrdered (first: XmlBasedJson, second: XmlBasedJson): void {
    const firstOtherLoc = extractRange(first[this.config.attributeName])
    const secondOtherLoc = extractRange(second[this.config.attributeName])
    if (compareRanges(firstOtherLoc, secondOtherLoc) > 0) {
      throw new XmlParseError(`expected the first child to be the lhs, yet received ${JSON.stringify(first)} & ${JSON.stringify(second)}`)
    }
  }

  private assureName (obj: XmlBasedJson, expectedName: string): void {
    // TODO: allow us to configure the name?
    const name = this.getName(obj)
    if (name !== expectedName) {
      throw new XmlParseError(`expected name to be ${expectedName}, yet received ${name} for ${JSON.stringify(obj)}`)
    }
  }

  private getName (content: XmlBasedJson): string {
    return this.revertTokenReplacement(getKeysGuarded(content, '#name') as string)
  }

  private objectWithArrUnwrap (obj: XmlBasedJson): XmlBasedJson {
    if (Array.isArray(obj)) {
      if (obj.length !== 1) {
        throw new XmlParseError(`expected only one element in the wrapped array, yet received ${JSON.stringify(obj)}`)
      }
      return obj[0]
    } else if (typeof obj === 'object') {
      return obj
    } else {
      throw new XmlParseError(`expected array or object, yet received ${JSON.stringify(obj)}`)
    }
  }

  /**
   * Returns an ExprList if there are multiple children, otherwise returns the single child directly with no expr wrapper
   */
  private parseExpr (obj: XmlBasedJson): Lang.RNode {
    parseLog.debug(`trying to parse expr ${JSON.stringify(obj)}`)
    const {
      unwrappedObj,
      content,
      location
    } = this.retrieveMetaStructure(obj)

    const children = this.parseBasedOnType(getKeysGuarded(unwrappedObj, this.config.childrenName))
    if (children.length === 1) {
      return children[0]
    } else {
      return {
        type:   Lang.Type.ExpressionList,
        location,
        children,
        lexeme: content
      }
    }
  }

  private retrieveMetaStructure (obj: XmlBasedJson): {
    unwrappedObj: XmlBasedJson
    location:     Lang.Range
    content:      string
  } {
    const unwrappedObj = this.objectWithArrUnwrap(obj)
    const core = getKeysGuarded(unwrappedObj, this.config.contentName, this.config.attributeName)
    const location = extractRange(core[this.config.attributeName])
    const content = core[this.config.contentName]
    return {
      unwrappedObj,
      location,
      content
    }
  }

  private parseNumber (obj: XmlBasedJson): Lang.RNumber | Lang.RLogical | RSymbol<NoInfo, typeof RNa> {
    parseLog.debug(`trying to parse number ${JSON.stringify(obj)}`)
    const {
      location,
      content
    } = this.retrieveMetaStructure(obj)
    const common = {
      location,
      lexeme: content
    }
    if (isNA(content)) { /* the special symbol */
      return {
        ...common,
        type: Lang.Type.Symbol,
        content
      }
    } else if (isBoolean(content)) {
      return {
        ...common,
        type:    Lang.Type.Logical,
        content: boolean2ts(content)
      }
    } else {
      return {
        ...common,
        type:    Lang.Type.Number,
        content: number2ts(content)
      }
    }
  }

  private parseString (obj: XmlBasedJson): Lang.RString {
    parseLog.debug(`trying to parse string ${JSON.stringify(obj)}`)
    const {
      location,
      content
    } = this.retrieveMetaStructure(obj)
    return {
      type:    Lang.Type.String,
      location,
      content: string2ts(content),
      lexeme:  content
    }
  }

  private parseSymbol (obj: XmlBasedJson): Lang.RSymbol {
    parseLog.debug(`trying to parse symbol ${JSON.stringify(obj)}`)
    const {
      location,
      content
    } = this.retrieveMetaStructure(obj)
    return {
      type:   Lang.Type.Symbol,
      location,
      content,
      lexeme: content
    }
  }

  private retrieveOpName (op: NamedXmlBasedJson): string {
    /*
     * only real arithmetic ops have their operation as their own name, the others identify via content
     */
    return op.content[this.config.contentName]
  }
}

export async function parse (xmlString: string, tokenMap: XmlParserConfig['tokenMap']): Promise<Lang.RExpressionList> {
  const parser = new XmlBasedAstParser({ tokenMap })
  return await parser.parse(xmlString)
}
