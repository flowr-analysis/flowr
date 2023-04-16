import { deepMergeObject, type MergeableRecord } from '../../../util/objects'
import * as xml2js from 'xml2js'
import * as Lang from './model'
import { rangeFrom } from './model'
import { log } from '../../../util/log'
import { boolean2ts, isBoolean, number2ts, string2ts } from '../values'

const astLogger = log.getSubLogger({ name: 'ast' })

interface AstParser<Target extends Lang.Base> {
  parse: (xmlString: string) => Promise<Target>
}

interface XmlParserConfig extends MergeableRecord {
  attributeName: string
  contentName: string
  childrenName: string
  // Mapping from xml tag name to the real operation of the node
  tokenMap?: Record<string, string /* TODO: change this to OP enum or so */>
}

const DEFAULT_XML_PARSER_CONFIG: XmlParserConfig = {
  attributeName: '@attributes',
  contentName: '@content',
  childrenName: '@children'
}

class XmlParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XmlParseError'
  }
}

type XmlBasedJson = Record<string, any>
interface NamedXmlBasedJson { name: string, content: XmlBasedJson }

function getKeysGuarded(obj: XmlBasedJson, key: string): any
function getKeysGuarded(obj: XmlBasedJson, ...key: string[]): Record<string, any>
function getKeysGuarded(obj: XmlBasedJson, ...key: string[]): (Record<string, any> | string) {
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

function extractRange(ast: XmlBasedJson): Lang.Range {
  const { line1, col1, line2, col2 } = getKeysGuarded(ast, 'line1', 'col1', 'line2', 'col2')
  return rangeFrom(line1, col1, line2, col2)
}

class XmlBasedAstParser implements AstParser<Lang.RExprList> {
  private objectRoot: undefined | XmlBasedJson
  private readonly config: XmlParserConfig

  constructor(config?: Partial<XmlParserConfig>) {
    this.config = deepMergeObject(DEFAULT_XML_PARSER_CONFIG, config)
    astLogger.debug(`config for xml parser: ${JSON.stringify(this.config)}`)
  }

  public async parse(xmlString: string): Promise<Lang.RExprList> {
    this.objectRoot = await this.parseToObj(xmlString) as XmlBasedJson

    return this.parseRootObjToAst(this.objectRoot)
  }

  private async parseToObj(xmlString: string): Promise<object> {
    return await xml2js.parseStringPromise(xmlString, {
      attrkey: this.config.attributeName,
      charkey: this.config.contentName,
      childkey: this.config.childrenName,
      charsAsChildren: false,
      explicitChildren: true,
      // we need this for semicolons etc, while we keep the old broken components we ignore them completely
      preserveChildrenOrder: true,
      normalize: true,
      strict: true
    })
  }

  private parseRootObjToAst(obj: XmlBasedJson): Lang.RExprList {
    const exprContent = getKeysGuarded(obj, Lang.Type.ExprList)
    this.assureName(exprContent, Lang.Type.ExprList)

    const children = getKeysGuarded(exprContent, this.config.childrenName)

    // const children = this.retrieveChildren(exprList)
    // TODO: at total object in any case of error?
    return { type: Lang.Type.ExprList, children: this.parseBasedOnType(children) }
  }

  private revertTokenReplacement(token: string): string {
    const result = this.config.tokenMap?.[token] ?? token
    astLogger.debug(`reverting ${token}=>${result}`)
    return result
  }

  // TODO: make isolateMarker more performant
  private isolateMarker(obj: NamedXmlBasedJson[], predicate: (name: string) => boolean, multipleErrorMessage: string): {
    readonly marker: NamedXmlBasedJson
    readonly others: NamedXmlBasedJson[]
  } | undefined {
    let marker: NamedXmlBasedJson | undefined
    for (const elem of obj) {
      if (predicate(elem.name)) {
        if (marker !== undefined) {
          throw new XmlParseError(`found multiple markers for ${multipleErrorMessage} in ${JSON.stringify(obj)}`)
        }
        marker = elem
      }
    }
    if (marker === undefined) {
      return undefined
    }
    return { marker, others: obj.filter((elem) => elem !== marker) }
  }

  private parseBasedOnType(obj: XmlBasedJson[]): Lang.RNode[] {
    const mappedWithName: NamedXmlBasedJson[] = obj.map((content) => ({ name: this.getName(content), content }))

    // TODO: if any has a semicolon we must respect that and split to expr list
    // TODO: improve with error message

    const special = this.isolateMarker(mappedWithName, n => {
      return Lang.ArithmeticOperators.includes(n)
    }, Lang.ArithmeticOperators.join(', '))
    if (special !== undefined) {
      return [this.parseArithmeticOp(special)]
    }

    // otherwise perform default parsing
    const parsedNodes: Lang.RNode[] = []
    // used to indicate the new root node of this set of nodes
    // TODO: refactor?
    for (const elem of mappedWithName) {
      // TODO: configure #name
      if (elem.name === Lang.Type.Expr) {
        parsedNodes.push(this.parseExpr(elem.content))
      } else if (elem.name === Lang.Type.Number) {
        parsedNodes.push(this.parseNumber(elem.content))
      } else if (elem.name === Lang.Type.String) {
        parsedNodes.push(this.parseString(elem.content))
      } else {
        throw new XmlParseError(`unknown type ${elem.name}`)
      }
    }
    return parsedNodes
  }

  private assureName(obj: XmlBasedJson, expectedName: string): void {
    // TODO: allow us to configure the name?
    const name = this.getName(obj)
    if (name !== expectedName) {
      throw new XmlParseError(`expected name to be ${expectedName}, yet received ${name} for ${JSON.stringify(obj)}`)
    }
  }

  private getName(content: XmlBasedJson): string {
    return this.revertTokenReplacement(getKeysGuarded(content, '#name') as string)
  }

  private objectWithArrUnwrap(obj: XmlBasedJson): XmlBasedJson {
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
  private parseExpr(obj: XmlBasedJson): Lang.RNode {
    astLogger.debug(`trying to parse expr ${JSON.stringify(obj)}`)
    const { unwrappedObj, content, location } = this.retrieveMetaStructure(obj)
    const children = this.parseBasedOnType(getKeysGuarded(unwrappedObj, this.config.childrenName))
    if (children.length === 1) {
      return children[0]
    } else {
      return { type: Lang.Type.ExprList, location, content, children }
    }
  }

  private retrieveMetaStructure(obj: XmlBasedJson): {
    unwrappedObj: XmlBasedJson
    location: Lang.Range
    content: string
  } {
    const unwrappedObj = this.objectWithArrUnwrap(obj)
    const core = getKeysGuarded(unwrappedObj, this.config.contentName, this.config.attributeName)
    const location = extractRange(core[this.config.attributeName])
    const content = core[this.config.contentName]
    return { unwrappedObj, location, content }
  }

  private parseNumber(obj: XmlBasedJson): Lang.RNumber | Lang.RLogical {
    astLogger.debug(`trying to parse number ${JSON.stringify(obj)}`)
    const { location, content } = this.retrieveMetaStructure(obj)
    if (isBoolean(content)) {
      return { type: Lang.Type.Boolean, location, content: boolean2ts(content) }
    } else {
      // TODO: need to parse R numbers to TS numbers
      return { type: Lang.Type.Number, location, content: number2ts(content) }
    }
  }

  private parseString(obj: XmlBasedJson): Lang.RString {
    astLogger.debug(`trying to parse string ${JSON.stringify(obj)}`)
    const { location, content } = this.retrieveMetaStructure(obj)
    return { type: Lang.Type.String, location, content: string2ts(content) }
  }

  private parseArithmeticOp(special: { marker: NamedXmlBasedJson, others: NamedXmlBasedJson[] }): Lang.RBinaryOp {
    astLogger.debug(`trying to parse arithmetic op ${JSON.stringify(special)}`)
    if (special.others.length !== 2) {
      throw new XmlParseError(`expected exactly two children for arithmetic op (lhs & rhs), yet received ${JSON.stringify(special)}`)
    }
    // TODO: guard against lengths etc?
    const [lhs] = this.parseBasedOnType([special.others[0].content])
    const [rhs] = this.parseBasedOnType([special.others[1].content])

    const { location } = this.retrieveMetaStructure(special.marker.content)
    return { type: Lang.Type.BinaryOp, location, lhs, rhs, op: special.marker.name }
  }
}

export async function parse(xmlString: string, tokenMap: XmlParserConfig['tokenMap']): Promise<Lang.RExprList> {
  const parser = new XmlBasedAstParser({ tokenMap })
  return await parser.parse(xmlString)
}
