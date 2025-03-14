import type { LinkTo } from '../../call-context-query/call-context-query-format';

/** when to read the argument value from a linked function */
export enum DependencyInfoLinkConstraint {
    Always    = 'always',
    IfUnknown = 'if-unknown',
}

/**
 * A dependency link may have attached information. If you pass it, we try to resolve the argument value from the linked function
 * if the `when` constraint is met.
 */
export type DependencyInfoLink = LinkTo<RegExp | string, Omit<FunctionInfo, 'name' | 'linkTo' | 'package'> & { when: DependencyInfoLinkConstraint } | undefined>
export type DependencyInfoLinkAttachedInfo = DependencyInfoLink['attachLinkInfo']

export interface FunctionInfo {
    package?:      string
    name:          string
    /** the index if the argument can be positional, unnamed in case of something like `...`, if the argument must be given with the name, please leave undefined */
    argIdx?:       number | 'unnamed'
    argName?:      string
    linkTo?:       DependencyInfoLink[]
    resolveValue?: boolean | 'library'
    // the function is not to be counted as a dependency if the argument is missing
    ignoreIf?:     'arg-missing'
}