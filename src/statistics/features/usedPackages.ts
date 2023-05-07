import { Feature, formatMap } from '../feature'
import { MergeableRecord } from '../../util/objects'
import { groupCount } from '../../util/arrays'
import { parseWithVariable, withVariable, xpath } from '../../util/xpath'

export type SinglePackageInfo = string

export interface UsedPackageInfo extends MergeableRecord {
  library:              SinglePackageInfo[]
  require:              SinglePackageInfo[]
  loadNamespace:        SinglePackageInfo[]
  requireNamespace:     SinglePackageInfo[]
  attachNamespace:      SinglePackageInfo[]
  '::':                 SinglePackageInfo[]
  ':::':                SinglePackageInfo[]
  /** just contains all occurrences where it is impossible to statically determine which package is loaded */
  '<loadedByVariable>': string[]
}

export const initialUsedPackageInfos = (): UsedPackageInfo => ({
  library:              [],
  require:              [],
  loadNamespace:        [],
  requireNamespace:     [],
  attachNamespace:      [],
  '::':                 [],
  ':::':                [],
  '<loadedByVariable>': []
})


// based on the extraction routine of lintr search for function calls which are not character-loads (we can not trace those...)
const [libraryQuery, requireQuery] = parseWithVariable(`
  //SYMBOL_FUNCTION_CALL[text() = $variable]
    /parent::expr
    /parent::expr[
      expr[2][STR_CONST]
      or (
        expr[2][SYMBOL]
        and not(
          SYMBOL_SUB[text() = 'character.only']
          /following-sibling::expr[1]
          /NUM_CONST[text() = 'TRUE' or text() = 'T']
        )
      )
    ]/OP-LEFT-PAREN[1]/following-sibling::expr[1][SYMBOL | STR_CONST]/*
`, 'variable', 'library', 'require')

// there is no except in xpath 1.0?
const libraryOrRequireWithVariable = withVariable(`
    //SYMBOL_FUNCTION_CALL[text() = $variable]
    /parent::expr
    /parent::expr[
        expr[2][SYMBOL]
        and (
          SYMBOL_SUB[text() = 'character.only']
          /following-sibling::expr[1]
          /NUM_CONST[text() = 'TRUE' or text() = 'T']
        )
    ]/OP-LEFT-PAREN[1]/following-sibling::expr[1][SYMBOL | STR_CONST]/*
`, 'variable', 'library', 'require')

const fnCallWithVariable = withVariable(`
  //SYMBOL_FUNCTION_CALL[text() = $variable]/../following-sibling::expr[1][SYMBOL]/*
`, 'variable', 'loadNamespace', 'requireNamespace', 'attachNamespace')

const queryWithVariable = xpath.parse([...libraryOrRequireWithVariable, ...fnCallWithVariable].join(' | '))

const [loadNamespaceQuery, requireNamespaceQuery, attachNamespaceQuery] = parseWithVariable(`
  //SYMBOL_FUNCTION_CALL[text() = $variable]/../following-sibling::expr[1][STR_CONST]/*
`, 'variable', 'loadNamespace', 'requireNamespace', 'attachNamespace')

// otherwise, the parser seems to fail
const [normalNsQuery, internalNsQuery] = parseWithVariable(`
  //NS_GET[text() = $variable]/../SYMBOL_PACKAGE[1]
  |
  //NS_GET_INT[text() = $variable]/../SYMBOL_PACKAGE[1]
`, 'variable', '::', ':::')

const queries: { type: keyof UsedPackageInfo, query: XPathExpression }[] = [
  { type: 'library',              query: libraryQuery },
  { type: 'require',              query: requireQuery },
  { type: 'loadNamespace',        query: loadNamespaceQuery },
  { type: 'requireNamespace',     query: requireNamespaceQuery },
  { type: 'attachNamespace',      query: attachNamespaceQuery },
  { type: '::',                   query: normalNsQuery },
  { type: ':::',                  query: internalNsQuery }
]

function append(existing: UsedPackageInfo, fn: keyof UsedPackageInfo, nodes: string[]) {
  (existing[fn] as unknown[]).push(...new Set(nodes))
}

export const usedPackages: Feature<UsedPackageInfo> = {
  name:        'Used Packages',
  description: 'All the packages used in the code',

  append(existing: UsedPackageInfo, input: Document): UsedPackageInfo {
    // we will unify in the end, so we can count, group etc. but we do not re-count multiple packages in the same file
    for(const q of queries) {
      const nodes = xpath.queryAllContent(q.query, input, '<unknown>')
      append(existing, q.type, nodes)
    }

    const loadWithVariable = xpath.queryAllContent(queryWithVariable, input, '<unknown>')
    append(existing, '<loadedByVariable>', loadWithVariable)

    return existing
  },

  toString(data: UsedPackageInfo): string {
    let result = '---used packages (does not care for roxygen comments!)-------------'
    result += `\n\tloaded by a variable (unknown): ${data['<loadedByVariable>'].length}`
    for(const fn of [ 'library', 'require', 'loadNamespace', 'requireNamespace', 'attachNamespace', '::', ':::' ] as (keyof UsedPackageInfo)[]) {
      const pkgs = data[fn] as string[]
      result += `\n\t${fn} (${pkgs.length} times) ${formatMap(groupCount<SinglePackageInfo>(pkgs))}`
    }

    return result
  }
}




