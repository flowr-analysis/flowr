import { SinglePackageInfo } from './usedPackages'
import { FunctionNameInfo } from './definedFunctions'
import { Feature, FeatureInfo, Query } from '../feature'
import * as xpath from 'xpath-ts2'

export interface UsedFunction {
  package:  SinglePackageInfo,
  function: FunctionNameInfo
}


// TODO: get corresponding package with getNamespaceExports etc?
export interface FunctionUsageInfo extends FeatureInfo {
  allCalls:    number
  /* sys.* */
  systemCalls: number
}

export const initialValueInfo = (): FunctionUsageInfo => ({
  allCalls:    0,
  systemCalls: 0
})

const functionCallQuery: Query = xpath.parse(`//SYMBOL_FUNCTION_CALL`)

export const usedFunctions: Feature<FunctionUsageInfo> = {
  name:        'used functions',
  description: 'all functions called, split into various sub-categories',

  append(existing: FunctionUsageInfo, input: Document): FunctionUsageInfo {
    const allFunctionCalls = functionCallQuery.select({ node: input })

    // TODO:
    // existing.allCalls.push(...allFunctionCalls.map(n => n.textContent ?? '<unknown>'))

    return existing
  },

  toString(data: FunctionUsageInfo): string {
    // \tall calls: ${data.allCalls.length}${formatMap(groupCount(data.allCalls), details)}
    return `---used functions-------------
    `
  }
}
