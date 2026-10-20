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
import { STOP_WITH_CALL_ARG } from './rules/stop-with-call-arg';
import { ROXYGEN_ARGS } from './rules/roxygen-arguments';
import { PROBLEMATIC_INPUTS } from './rules/problematic-inputs';
import { SOFTWARE_HAS_LICENSE } from './rules/software-has-license';
import { SOFTWARE_HAS_TESTS } from './rules/software-has-tests';
import { NO_LEAKED_CREDENTIALS } from './rules/no-leaked-credentials';
import { UNDEFINED_SYMBOL } from './rules/undefined-symbol';
import { UNUSED_IMPORT } from './rules/unused-import';
import { SYNTACTICALLY_VALID } from './rules/syntactically-valid';
import { UNCLOSED_CONNECTION } from './rules/unclosed-connection';
import { UNESCAPED_ARGUMENTS } from './rules/unescaped-arguments';
import { NAMESPACE_ACCESS } from './rules/namespace-access';
import { CLASS_STRING_COMPARISON } from './rules/cmd-check/class-string-comparison';
import { DESCRIPTION_METADATA } from './rules/cmd-check/description-metadata';
import { DOCUMENTATION_MISMATCH } from './rules/cmd-check/documentation-mismatch';
import { NON_ASCII_CODE } from './rules/cmd-check/non-ascii-code';
import { TRUE_FALSE_ABBREVIATION } from './rules/cmd-check/true-false-abbreviation';
import { BOGUS_RETURN } from './rules/cmd-check/bogus-return';
import { PACKAGE_HOOKS } from './rules/cmd-check/package-hooks';
import { PACKAGE_STRUCTURE } from './rules/cmd-check/package-structure';
import { GLOBAL_ENVIRONMENT_MODIFICATION } from './rules/cmd-check/global-environment-modification';
import { NAMESPACE_TAMPERING } from './rules/cmd-check/namespace-tampering';
import { S3_METHOD_CONSISTENCY } from './rules/cmd-check/s-three-method-consistency';
import { FOREIGN_FUNCTION_CALLS } from './rules/cmd-check/foreign-function-calls';
import { DEPENDENCY_DECLARATION } from './rules/cmd-check/dependency-declaration';
import { CALL_ARGUMENTS } from './rules/cmd-check/call-arguments';
import { COMPILED_CODE } from './rules/cmd-check/compiled-code';
import { PACKAGE_METAFILES } from './rules/cmd-check/package-metafiles';
import { RD_FILES } from './rules/cmd-check/rd-files';
import { PACKAGE_DATA } from './rules/cmd-check/package-data';
import { PACKAGE_RUNTIME } from './rules/cmd-check/package-runtime';
import { AUTOLOAD_FILES } from './rules/autoload-files';

/**
 * The registry of currently supported linting rules.
 * A linting rule can be executed on a dataflow pipeline result using {@link executeLintingRule}.
 */
export const LintingRules = {
	'deprecated-functions':            DEPRECATED_FUNCTIONS,
	'file-path-validity':              FILE_PATH_VALIDITY,
	'seeded-randomness':               SEEDED_RANDOMNESS,
	'absolute-file-paths':             ABSOLUTE_PATH,
	'unused-definitions':              UNUSED_DEFINITION,
	'naming-convention':               NAMING_CONVENTION,
	'network-functions':               NETWORK_FUNCTIONS,
	'dataframe-access-validation':     DATA_FRAME_ACCESS_VALIDATION,
	'dead-code':                       DEAD_CODE,
	'useless-loop':                    USELESS_LOOP,
	'problematic-inputs':              PROBLEMATIC_INPUTS,
	'stop-call':                       STOP_WITH_CALL_ARG,
	'roxygen-arguments':               ROXYGEN_ARGS,
	'software-has-license':            SOFTWARE_HAS_LICENSE,
	'software-has-tests':              SOFTWARE_HAS_TESTS,
	'no-leaked-credentials':           NO_LEAKED_CREDENTIALS,
	'undefined-symbol':                UNDEFINED_SYMBOL,
	'unused-import':                   UNUSED_IMPORT,
	'syntactically-valid':             SYNTACTICALLY_VALID,
	'unclosed-connection':             UNCLOSED_CONNECTION,
	'unescaped-arguments':             UNESCAPED_ARGUMENTS,
	'namespace-access':                NAMESPACE_ACCESS,
	'class-string-comparison':         CLASS_STRING_COMPARISON,
	'description-metadata':            DESCRIPTION_METADATA,
	'documentation-mismatch':          DOCUMENTATION_MISMATCH,
	'non-ascii-code':                  NON_ASCII_CODE,
	'true-false-abbreviation':         TRUE_FALSE_ABBREVIATION,
	'bogus-return':                    BOGUS_RETURN,
	'package-hooks':                   PACKAGE_HOOKS,
	'global-environment-modification': GLOBAL_ENVIRONMENT_MODIFICATION,
	'namespace-tampering':             NAMESPACE_TAMPERING,
	's3-method-consistency':           S3_METHOD_CONSISTENCY,
	'foreign-function-calls':          FOREIGN_FUNCTION_CALLS,
	'dependency-declaration':          DEPENDENCY_DECLARATION,
	'call-arguments':                  CALL_ARGUMENTS,
	'package-structure':               PACKAGE_STRUCTURE,
	'compiled-code':                   COMPILED_CODE,
	'package-metafiles':               PACKAGE_METAFILES,
	'rd-files':                        RD_FILES,
	'package-data':                    PACKAGE_DATA,
	'package-runtime':                 PACKAGE_RUNTIME,
	'autoload-files':                  AUTOLOAD_FILES
} as const;

export type LintingRuleNames = keyof typeof LintingRules;

export type LintingRuleMetadata<Name extends LintingRuleNames> =
	typeof LintingRules[Name] extends LintingRule<infer _Result, infer Metadata, infer _Config, infer _Info, infer _Elements> ? Metadata : never;
export type LintingRuleResult<Name extends LintingRuleNames> =
	typeof LintingRules[Name] extends LintingRule<infer Result, infer _Metadata, infer _Config, infer _Info, infer _Elements> ? Result : never;
export type LintingRuleConfig<Name extends LintingRuleNames> =
	typeof LintingRules[Name] extends LintingRule<infer _Result, infer _Metadata, infer Config, infer _Info, infer _Elements> ? Config : never;
