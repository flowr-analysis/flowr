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
export type DependencyInfoLink = LinkTo<CallNameTypes, Omit<FunctionInfo, 'name' | 'linkTo' | 'package'> & { when: DependencyInfoLinkConstraint } | undefined>;
export type DependencyInfoLinkAttachedInfo = DependencyInfoLink['attachLinkInfo'];

export interface FunctionArgInfo {
	/** the index if the argument can be positional, unnamed in case of something like `...`, if the argument must be given with the name, please leave undefined */
	argIdx?:       number | 'unnamed'
	argName?:      string
	resolveValue?: boolean | 'library'
}

/** Describes a function that may create a dependency */
export interface FunctionInfo extends FunctionArgInfo {
	/** Which package does the function belong to */
	package?:        string
	/** The name of the function */
	name:            string
	/** links to other function calls to get the dependency from there (e.g., with `sink` for `print`) */
	linkTo?:         DependencyInfoLink[]
	/** default value for the argument if no binding value is found, please be aware, that categories can define global defaults, these are overwritten by the per-function defaults */
	defaultValue?:   string
	/** the function is not to be counted as a dependency if the argument is missing */
	ignoreIf?:       'arg-missing' | 'mode-only-read' | 'mode-only-write' | 'arg-true' | 'arg-false',
	/** additional info on arguments - e.g. for the mode flag */
	additionalArgs?: Record<string, FunctionArgInfo>
}
