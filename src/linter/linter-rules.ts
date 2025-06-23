import { DEPRECATED_FUNCTIONS } from './rules/deprecated-functions';
import type { LintingRule } from './linter-format';
import { FILE_PATH_VALIDITY } from './rules/file-path-validity';
import { ABSOLUTE_PATH } from './rules/absolute-path';
import { UNUSED_DEFINITION } from './rules/unused-definition';
import { NAMING_CONVENTION } from './rules/naming-convention';

/**
 * The registry of currently supported linting rules.
 * A linting rule can be executed on a dataflow pipeline result using {@link executeLintingRule}.
 */
export const LintingRules = {
	'deprecated-functions': DEPRECATED_FUNCTIONS,
	'file-path-validity':   FILE_PATH_VALIDITY,
	'absolute-file-paths':  ABSOLUTE_PATH,
	'unused-definitions':   UNUSED_DEFINITION,
	'naming-convention':    NAMING_CONVENTION
} as const;

export type LintingRuleNames = keyof typeof LintingRules

export type LintingRuleMetadata<Name extends LintingRuleNames> =
	typeof LintingRules[Name] extends LintingRule<infer _Result, infer Metadata, infer _Config, infer _Info, infer _Elements> ? Metadata : never
export type LintingRuleResult<Name extends LintingRuleNames> =
	typeof LintingRules[Name] extends LintingRule<infer Result, infer _Metadata, infer _Config, infer _Info, infer _Elements> ? Result : never
export type LintingRuleConfig<Name extends LintingRuleNames> =
	typeof LintingRules[Name] extends LintingRule<infer _Result, infer _Metadata, infer Config, infer _Info, infer _Elements> ? Config : never
