import type { FunctionInfo } from './function-info';

export const OpenFunctions: FunctionInfo[] = [
    { package: 'base',         name: 'textConnection',    argIdx: 0,          argName: 'package', resolveValue: true },
    { package: 'base',         name: 'open',              argIdx: 0,          argName: 'package', resolveValue: true }
] as const;