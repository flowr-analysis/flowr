import type { CallNameTypes, LinkTo } from '../../call-context-query/call-context-query-format';

/** when to read the argument value from a linked function */
export enum DependencyInfoLinkConstraint {
    Always    = 'always',
    IfUnknown = 'if-unknown',
}

/**
 * A dependency link may have attached information. If you pass it, we try to resolve the argument value from the linked function
 * if the `when` constraint is met.
 */
export type DependencyInfoLink = LinkTo<CallNameTypes, Omit<FunctionInfo, 'name' | 'linkTo' | 'package'> & { when: DependencyInfoLinkConstraint } | undefined>
export type DependencyInfoLinkAttachedInfo = DependencyInfoLink['attachLinkInfo']

export interface FunctionArgInfo {
    /** the index if the argument can be positional, unnamed in case of something like `...`, if the argument must be given with the name, please leave undefined */
    argIdx?:       number | 'unnamed'
    argName?:      string
    resolveValue?: boolean | 'library'
}

export interface FunctionInfo extends FunctionArgInfo{
    package?:        string
    name:            string
    linkTo?:         DependencyInfoLink[]
    // the function is not to be counted as a dependency if the argument is missing
    ignoreIf?:       'arg-missing' | 'mode-only-read' | 'mode-only-write',
    /** additional info on arguments - e.g. for the mode flag */
    additionalArgs?: Record<string, FunctionArgInfo>
}
