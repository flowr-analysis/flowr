/**
 * Specify the tags for the linter rules.
 */
export enum LintingRuleTag {
	/**
	 * This rule is used to detect bugs in the code.
	 * Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc.
	 * is to be considered a bug. Otherwise, it may be a smell or a style issue.
	 */
	Bug = 'bug',
	/**
	 * This signals the use of deprecated functions or features.
	 */
	Deprecated = 'deprecated',
	/**
	 * This rule is used to detect issues that are related to the documentation of the code.
	 * For example, missing or misleading comments.
	 */
	Documentation = 'documentation',
	/**
	 * This marks rules which are currently considered experimental, _not_ that they detect experimental code.
	 */
	Experimental = 'experimental',
	/**
	 * This rule is used to detect issues that are related to the performance of the code.
	 * For example, inefficient algorithms, unnecessary computations, or unoptimized data structures.
	 */
	Performance = 'performance',
	/**
	 * This rule is used to detect issues that are related to the portability of the code.
	 * For example, platform-specific code, or code that relies on specific R versions or packages.
	 */
	Robustness = 'robustness',
	/**
	 * The rule is specific to R version 3.x.
	 */
	Rver3 = 'rver3',
	/**
	 * The rule is specific to R version 4.x.
	 */
	Rver4 = 'rver4',
	/**
	 * This rule is used to detect issues that are related to the readability of the code.
	 * For example, complex expressions, long lines, or inconsistent formatting.
	 */
	Readability = 'readability',
	/**
	 * This rule is used to detect issues that are related to the reproducibility of the code.
	 * For example, missing or incorrect random seeds, or missing data.
	 */
	Reproducibility = 'reproducibility',
	/**
	 * This rule is used to detect security-critical.
	 * For example, missing input validation.
	 */
	Security = 'security',
	/**
	 * This rule is used to detect issues that are related to the shiny framework.
	 */
	Shiny = 'shiny',
	/**
	 * This rule is used to detect issues that do not directly affect the semantics of the code,
	 * but are still considered bad practice.
	 */
	Smell = 'smell',
	/**
	 * This rule is used to detect issues that are related to the style of the code.
	 * For example, inconsistent naming conventions, or missing or incorrect formatting.
	 */
	Style = 'style',
	/**
	 * This rule is used to detect issues that are related to the (re-)usability of the code.
	 * For example, missing or incorrect error handling, or missing or incorrect user interface elements.
	 */
	Usability = 'usability',
	/**
	 * This rule may provide quickfixes to automatically fix the issues it detects.
	 */
	QuickFix = 'quickfix'
}
