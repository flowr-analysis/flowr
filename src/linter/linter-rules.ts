import { DEPRECATED_FUNCTIONS } from './rules/deprecated-functions';
import type { LintingRule } from './linter-format';
import { FILE_PATH_VALIDITY } from './rules/file-path-validity';
import { ABSOLUTE_PATH } from './rules/absolute-path';
import { UNUSED_DEFINITION } from './rules/unused-definition';
import { DEAD_CODE } from './rules/dead-code';
import { SEEDED_RANDOMNESS } from './rules/seeded-randomness';
import { NAMING_CONVENTION } from './rules/naming-convention';
import { DATA_FRAME_ACCESS_VALIDATION } from './rules/dataframe-access-validation';
import { USELESS_LOOP } from './rules/useless-loop';
import { NETWORK_FUNCTIONS } from './rules/network-functions';

/**
 * The registry of currently supported linting rules.
 * A linting rule can be executed on a dataflow pipeline result using {@link executeLintingRule}.
 */
export const LintingRules = {
	'deprecated-functions':        DEPRECATED_FUNCTIONS,
	'file-path-validity':          FILE_PATH_VALIDITY,
	'seeded-randomness':           SEEDED_RANDOMNESS,
	'absolute-file-paths':         ABSOLUTE_PATH,
	'unused-definitions':          UNUSED_DEFINITION,
	'naming-convention':           NAMING_CONVENTION,
	'network-functions':           NETWORK_FUNCTIONS,
	'dataframe-access-validation': DATA_FRAME_ACCESS_VALIDATION,
	'dead-code':                   DEAD_CODE,
	'useless-loop':                USELESS_LOOP
} as const;

export type LintingRuleNames = keyof typeof LintingRules;

export type LintingRuleMetadata<Name extends LintingRuleNames> =
	typeof LintingRules[Name] extends LintingRule<infer _Result, infer Metadata, infer _Config, infer _Info, infer _Elements> ? Metadata : never;
export type LintingRuleResult<Name extends LintingRuleNames> =
	typeof LintingRules[Name] extends LintingRule<infer Result, infer _Metadata, infer _Config, infer _Info, infer _Elements> ? Result : never;
export type LintingRuleConfig<Name extends LintingRuleNames> =
	typeof LintingRules[Name] extends LintingRule<infer _Result, infer _Metadata, infer Config, infer _Info, infer _Elements> ? Config : never;
