import { deepMergeObject, type MergeableRecord } from '../../../util/objects'
import * as xml2js from 'xml2js'
import { Logger } from 'tslog'
import { type Base, type RNode, type RExprList, Type } from './model'

const log = new Logger({ name: 'ast' })

interface AstParser<Target extends Base> {
  parse: (xmlString: string) => Promise<Target>
}

interface XmlParserConfig extends MergeableRecord {
  attributeName: string
  childrenName: string
  contentName: string
}

const DEFAULT_XML_PARSER_CONFIG: XmlParserConfig = {
  attributeName: 'attributes',
  childrenName: 'children',
  contentName: 'content'
}

class XmlParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XmlParseError'
  }
}

type XmlBasedJson = Record<string, any>

function getKeyGuarded(obj: XmlBasedJson, key: string): any {
  const keys = Object.keys(obj)
  if (!keys.includes(key)) {
    throw new XmlParseError(`expected obj to have key ${Type.ExprList}, yet received ${JSON.stringify(obj)}`)
  }
  return obj[key]
}

class XmlBasedAstParser implements AstParser<RExprList> {
  private objectRoot: undefined | XmlBasedJson
  private readonly config: XmlParserConfig

  constructor(config?: Partial<XmlParserConfig>) {
    this.config = deepMergeObject(DEFAULT_XML_PARSER_CONFIG, config)
  }

  public async parse(xmlString: string): Promise<RExprList> {
    this.objectRoot = await this.parseToObj(xmlString) as XmlBasedJson

    return this.foldRootObjToAst(this.objectRoot)
  }

  private async parseToObj(xmlString: string): Promise<object> {
    return await xml2js.parseStringPromise(xmlString, {
      attrkey: this.config.attributeName,
      charkey: this.config.contentName,
      explicitChildren: true,
      childkey: this.config.childrenName,
      charsAsChildren: false,
      explicitRoot: true,
      strict: true
    })
  }

  private foldRootObjToAst(obj: XmlBasedJson): RExprList {
    const exprList = getKeyGuarded(obj, Type.ExprList)
    const children = this.retrieveChildren(exprList)
    // TODO: at total object in any case of error?
    return { type: Type.ExprList, children: this.foldChildrenToAst(children) }
  }

  private retrieveChildren(obj: XmlBasedJson): object {
    const children = getKeyGuarded(obj, this.config.childrenName)
    if (Array.isArray(children)) {
      throw new XmlParseError(`needed key "${this.config.childrenName}" to yield an object for the children, but received ${JSON.stringify(children)} from ${JSON.stringify(obj)}`)
    }
    return children
  }

  private parseChildren(obj: object): RNode[] {
    const children = Object.entries(obj).map(([key, value]) => this.foldChildToAst(key, value))
    return children
  }

  /*  else if (Array.isArray(obj)) {
        return XmlBasedAstParser.foldArrayToAst(obj)
      } */
  private foldExprToAst(obj: object | null, idx: number): RNode {
    if (obj === null) {
      return XmlBasedAstParser.foldIllegalNull(obj, `@${idx} of parent!`)
    }
    console.log(idx, JSON.stringify(obj))
    return (null as unknown) as RNode
  }

  private static foldIllegalNull(obj: null, msg: string): any {
    throw new XmlParseError(`encountered null at ${JSON.stringify(obj)} (${msg})`)
  }

  private foldArrayToAst(obj: object[]): RNode {
    const children = obj.map(this.foldExprToAst)
    // TODO: default parse for semicolon etc.
    return { type: Type.Expr, location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, children: [] }
  }
}

export async function parse(xmlString: string): Promise<RExprList> {
  const parser = new XmlBasedAstParser()
  return await parser.parse(xmlString)
}
