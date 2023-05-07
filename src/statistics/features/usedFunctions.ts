import { SinglePackageInfo } from './usedPackages'
import { FunctionNameInfo } from './definedFunctions'

export interface UsedFunction {
  package:  SinglePackageInfo,
  function: FunctionNameInfo
}


// TODO: defined functions
// TODO: get corresponding package with getNamespaceExports etc?
