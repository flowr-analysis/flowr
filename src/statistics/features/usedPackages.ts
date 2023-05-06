import { Feature } from '../feature'
import * as xpath from 'xpath-ts'
import { MergeableRecord } from '../../util/objects'
import { EvalOptions } from 'xpath-ts/src/parse-api'

export type SinglePackageInfo = string

export interface PackageInfo extends MergeableRecord {
  library:              SinglePackageInfo[]
  require:              SinglePackageInfo[]
  loadNamespace:        SinglePackageInfo[]
  requireNamespace:     SinglePackageInfo[]
  attachNamespace:      SinglePackageInfo[]
  '::':                 SinglePackageInfo[]
  ':::':                SinglePackageInfo[]
  /** just contains all occurrences */
  '<loadedByVariable>': string[]
}

export const initialUsedPackageInfos = () => ({
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
const libraryOrRequire = xpath.parse(`
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
`)

// there is no except in xpath 1.0?
const libraryOrRequireWithVariable = xpath.parse(`
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
`)

const queryForFunctionCall = xpath.parse(`
  //SYMBOL_FUNCTION_CALL[text() = $variable]/../..//SYMBOL[1]
`)

// otherwise, the parser seems to fail
const queryForNsAccess = xpath.parse(`
  //NS_GET[text() = $variable]/../SYMBOL_PACKAGE[1]
  |
  //NS_GET_INT[text() = $variable]/../SYMBOL_PACKAGE[1]
`)

const queries: { types: readonly (keyof PackageInfo)[], query: { select(options?: EvalOptions): Node[] } }[] = [
  {
    types: [ 'library', 'require' ],
    query: libraryOrRequire
  },
  {
    types: [ 'loadNamespace', 'requireNamespace', 'attachNamespace' ],
    query: queryForFunctionCall
  },
  {
    types: [ '::', ':::' ],
    query: queryForNsAccess
  }
]

function append(existing: PackageInfo, fn: keyof PackageInfo, nodes: Node[]) {
  // @ts-expect-error - we know that the nodes are part of package info
  existing[fn] = [...existing[fn], ...new Set(nodes.map(node => node.textContent ?? '<unknown>'))]
}

export const usedPackages: Feature<PackageInfo> = {
  name:        'Used Packages',
  description: 'All the packages used in the code',

  append(existing: PackageInfo, input: Document): PackageInfo {
    // we will unify in the end, so we can count, group etc. but we do not re-count multiple packages in the same file
    for(const q of queries) {
      for(const fn of q.types) {
        const nodes = q.query.select({ node: input, variables: { variable: fn } })
        append(existing, fn, nodes)
      }
    }

    for(const fn of [ 'library', 'require' ]) {
      const nodes = libraryOrRequireWithVariable.select({ node: input, variables: { variable: fn } })
      append(existing, '<loadedByVariable>', nodes)
    }

    return existing
  }
}




