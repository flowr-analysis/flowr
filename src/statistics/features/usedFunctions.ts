import { SinglePackageInfo } from './usedPackages'

export type FunctionNameInfo = string

export interface UsedFunction {
  package:   SinglePackageInfo,
  functions: FunctionNameInfo[]
}
