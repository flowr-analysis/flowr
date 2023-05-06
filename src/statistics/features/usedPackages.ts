import { Feature } from '../feature'
import * as xpath from 'xpath-ts'
import { MergeableRecord } from '../../util/objects'

export type SinglePackageInfo = string

export interface PackageInfo extends MergeableRecord {
  library:          SinglePackageInfo[]
  require:          SinglePackageInfo[]
  loadNamespace:    SinglePackageInfo[]
  requireNamespace: SinglePackageInfo[]
  attachNamespace:  SinglePackageInfo[]
  '::':             SinglePackageInfo[]
  ':::':            SinglePackageInfo[]
}

export const initialUsedPackageInfos = () => ({
  library:          [],
  require:          [],
  loadNamespace:    [],
  requireNamespace: [],
  attachNamespace:  [],
  '::':             [],
  ':::':            []
})

const functionTypes: readonly (keyof PackageInfo)[] = ['library', 'require', 'loadNamespace', 'requireNamespace', 'attachNamespace'] as const
const symbolTypes: readonly (keyof PackageInfo)[] = ['::', ':::'] as const

function append(existing: PackageInfo, fn: keyof PackageInfo, nodes: Node[]) {
  // @ts-expect-error - we know that the nodes are part of package info
  existing[fn] = [...existing[fn], ...new Set(nodes.map(node => node.textContent ?? '<unknown>'))]
}

export const usedPackages: Feature<PackageInfo> = {
  name:        'Used Packages',
  description: 'All the packages used in the code',

  append(existing: PackageInfo, input: Document): PackageInfo {
    // we will unify in the end, so we can count, group etc. but we do not re-count multiple packages in the same file
    for(const fn of functionTypes){
      const nodes = queryForFunctionCall.select({ node: input, variables: { fnCall: fn } })
      append(existing, fn, nodes)
    }

    for(const sym of symbolTypes) {
      const nodes = queryForNsAccess.select({ node: input, variables: { ns: sym } })
      append(existing, sym, nodes)
    }

    return existing
  }
}

const queryForFunctionCall = xpath.parse(`
  //SYMBOL_FUNCTION_CALL[normalize-space(.) = $fnCall]/../..//SYMBOL[1]
`)

// otherwise, the parser seems to fail
const queryForNsAccess = xpath.parse(`
  //NS_GET[normalize-space(.) = $ns]/../SYMBOL_PACKAGE[1]
  |
  //NS_GET_INT[normalize-space(.) = $ns]/../SYMBOL_PACKAGE[1]
`)
