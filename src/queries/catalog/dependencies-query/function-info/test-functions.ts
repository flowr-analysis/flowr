import type { FunctionInfo } from './function-info';
import type { LinkToLastCall, LinkToNestedCall } from '../../call-context-query/call-context-query-format';

const ExpectFunctions: LinkToNestedCall = {
	type:     'link-to-nested-call',
	callName: new RegExp(/* testthat */
		'^(expect_equal|expect_identical|expect_error|expect_warning|expect_message|expect_condition|' +
		'expect_true|expect_false|expect_all_equal|expect_all_true|expect_all_false|expect_lt|expect_lte|expect_gt|expect_gte|' +
		'expect_length|expect_shape|expect_match|expect_no_match|expect_named|expect_null|expect_setequal|expect_mapequal|' +
		'expect_contains|expect_in|expect_disjoint|expect_type|expect_s3_class|expect_s4_class|expect_r6_class|expect_s7_class|' +
		'expect_vector|expect_no_error|expect_no_warning|expect_no_message|expect_no_condition|expect_invisible|expect_visible|' +
		'expect_output|expect_silent|expect_snapshot|expect_snapshot_value|expect_snapshot_file|announce_snapshot_file|' +
		'compare_file_binary|compare_file_text|snapshot_accept|snapshot_reject|snapshot_review|' +
		'fail|pass|expect_success|expect_failure|expect_snapshot_failure|show_failure|' +
		/* tinytest */
		'exit_file|exit_if_not|expect_equal|expect_identical|expect_equivalent|expect_true|expect_false|expect_silent|expect_null|' +
		'expect_inherits|expect_error|expect_warning|expect_message|expect_stdout|expect_equal_to_reference|' +
		'expect_equivalent_to_reference|expect_length|expect_match|ignore|report_side_effects|' +
		/* RUnit */
		'checkEquals|checkEqualsNumeric|checkIdentical|checkTrue|checkException|' +
		/* checkmate */
		'assertAccess|assert_access|assertArray|assert_array|assert_atomic|assertAtomic|assert_atomic_vector|assertAtomicVector|' +
		'assert_character|assertCharacter|assert_choice|assertChoice|assert_class|assertClass|assert_complex|assertComplex|' +
		'assert_count|assertCount|assert_data_frame|assertDataFrame|assert_data_table|assertDataTable|assert_date|assertDate|' +
		'assert_directory|assertDirectory|assert_directory_exists|assertDirectoryExists|assert_disjunct|assertDisjunct|assert_double|' +
		'assertDouble|assert_environment|assertEnvironment|assert_factor|assertFactor|assert_false|assertFalse|assert_file|assertFile|' +
		'assert_file_exists|assertFileExists|assert_flag|assertFlag|assert_formula|assertFormula|assert_function|assertFunction|' +
		'assert_int|assertInt|assert_integer|assertInteger|assert_list|assertList|assert_logical|assertLogical|assert_matrix|' +
		'assertMatrix|assert_multi_class|assertMultiClass|assert_named|assertNamed|assert_names|assertNames|assert_null|assertNull|' +
		'assert_number|assertNumber|assert_numeric|assertNumeric|assert_os|assertOs|assert_path_for_output|assertPathForOutput|' +
		'assert_permutation|assertPermutation|assert_posixct|assertPOSIXct|assert_r6|assertR6|assert_raw|assertRaw|assert_scalar|' +
		'assertScalar|assert_scalar_na|assertScalarNA|assert_set_equal|assertSetEqual|assert_string|assertString|assert_subset|' +
		'assertSubset|assert_tibble|assertTibble|assert_true|assertTrue|assert_vector|assertVector' +
		')$')
};

const ContextFunctions: LinkToLastCall = {
	type:     'link-to-last-call',
	callName: new RegExp('^(context)$')
};

export const TestFunctions: FunctionInfo[] = [
	{ package: 'testthat', name: 'test_that', argName: 'desc', argIdx: 0, resolveValue: true, linkTo: [ExpectFunctions,ContextFunctions] },
	{ package: 'testthat', name: 'describe', argName: 'description', argIdx: 0, resolveValue: true, linkTo: [ExpectFunctions,ContextFunctions] },
	{ package: 'testthat', name: 'it', argName: 'description', argIdx: 0, resolveValue: true, linkTo: [ExpectFunctions,ContextFunctions] },
	/* for now we do not want to list them extra:
	{ package: 'testthat', name: 'expect_lt' },
	{ package: 'testthat', name: 'expect_lte' },
	{ package: 'testthat', name: 'expect_gt' },
	{ package: 'testthat', name: 'expect_gte' },
	{ package: 'testthat', name: 'expect_length' },
	{ package: 'testthat', name: 'expect_shape' },
	{ package: 'testthat', name: 'expect_match' },
	{ package: 'testthat', name: 'expect_no_match' },
	{ package: 'testthat', name: 'expect_named' },
	{ package: 'testthat', name: 'expect_null' },
	{ package: 'testthat', name: 'expect_setequal' },
	{ package: 'testthat', name: 'expect_mapequal' },
	{ package: 'testthat', name: 'expect_contains' },
	{ package: 'testthat', name: 'expect_in' },
	{ package: 'testthat', name: 'expect_disjoint' },
	{ package: 'testthat', name: 'expect_type' },
	{ package: 'testthat', name: 'expect_s3_class' },
	{ package: 'testthat', name: 'expect_s4_class' },
	{ package: 'testthat', name: 'expect_r6_class' },
	{ package: 'testthat', name: 'expect_s7_class' },
	{ package: 'testthat', name: 'expect_vector' },
	{ package: 'testthat', name: 'expect_no_error' },
	{ package: 'testthat', name: 'expect_no_warning' },
	{ package: 'testthat', name: 'expect_no_message' },
	{ package: 'testthat', name: 'expect_no_condition' },
	{ package: 'testthat', name: 'expect_invisible' },
	{ package: 'testthat', name: 'expect_visible' },
	{ package: 'testthat', name: 'expect_output' },
	{ package: 'testthat', name: 'expect_silent' },
	{ package: 'testthat', name: 'expect_snapshot' },
	{ package: 'testthat', name: 'expect_snapshot_value' },
	{ package: 'testthat', name: 'expect_snapshot_file' },
	{ package: 'testthat', name: 'announce_snapshot_file' },
	{ package: 'testthat', name: 'compare_file_binary' },
	{ package: 'testthat', name: 'compare_file_text' },
	{ package: 'testthat', name: 'snapshot_accept' },
	{ package: 'testthat', name: 'snapshot_reject' },
	{ package: 'testthat', name: 'snapshot_review' },
	{ package: 'testthat', name: 'fail' },
	{ package: 'testthat', name: 'pass' },
	{ package: 'testthat', name: 'expect_success' },
	{ package: 'testthat', name: 'expect_failure' },
	{ package: 'testthat', name: 'expect_snapshot_failure' },
	{ package: 'testthat', name: 'show_failure' },

	{ package: 'tinytest', name: 'exit_file', argName: 'msg', resolveValue: true },
	{ package: 'tinytest', name: 'exit_if_not' },
	{ package: 'tinytest', name: 'expect_equal', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_identical', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_equivalent', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_true', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_false', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_silent', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_null', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_inherits', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_error', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_warning', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_message', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_stdout', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_equal_to_reference', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_equivalent_to_reference', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_length', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_match', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'ignore' },
	{ package: 'tinytest', name: 'report_side_effects' },

	{ package: 'RUnit', name: 'checkEquals', argName: 'msg', argIdx: 2, resolveValue: true },
	{ package: 'RUnit', name: 'checkEqualsNumeric', argName: 'msg', argIdx: 2, resolveValue: true },
	{ package: 'RUnit', name: 'checkIdentical', argName: 'msg', argIdx: 2, resolveValue: true },
	{ package: 'RUnit', name: 'checkTrue', argName: 'msg', argIdx: 1, resolveValue: true },
	{ package: 'RUnit', name: 'checkException', argName: 'msg', argIdx: 1, resolveValue: true },

	{ package: 'checkmate', name: 'assertAccess' },
	{ package: 'checkmate', name: 'assert_access' },
	{ package: 'checkmate', name: 'assertArray' },
	{ package: 'checkmate', name: 'assert_array' },
	{ package: 'checkmate', name: 'assert_atomic' },
	{ package: 'checkmate', name: 'assertAtomic' },
	{ package: 'checkmate', name: 'assert_atomic_vector' },
	{ package: 'checkmate', name: 'assertAtomicVector' },
	{ package: 'checkmate', name: 'assert_character' },
	{ package: 'checkmate', name: 'assertCharacter' },
	{ package: 'checkmate', name: 'assert_choice' },
	{ package: 'checkmate', name: 'assertChoice' },
	{ package: 'checkmate', name: 'assert_class' },
	{ package: 'checkmate', name: 'assertClass' },
	{ package: 'checkmate', name: 'assert_complex' },
	{ package: 'checkmate', name: 'assertComplex' },
	{ package: 'checkmate', name: 'assert_count' },
	{ package: 'checkmate', name: 'assertCount' },
	{ package: 'checkmate', name: 'assert_data_frame' },
	{ package: 'checkmate', name: 'assertDataFrame' },
	{ package: 'checkmate', name: 'assert_data_table' },
	{ package: 'checkmate', name: 'assertDataTable' },
	{ package: 'checkmate', name: 'assert_date' },
	{ package: 'checkmate', name: 'assertDate' },
	{ package: 'checkmate', name: 'assert_directory' },
	{ package: 'checkmate', name: 'assertDirectory' },
	{ package: 'checkmate', name: 'assert_directory_exists' },
	{ package: 'checkmate', name: 'assertDirectoryExists' },
	{ package: 'checkmate', name: 'assert_disjunct' },
	{ package: 'checkmate', name: 'assertDisjunct' },
	{ package: 'checkmate', name: 'assert_double' },
	{ package: 'checkmate', name: 'assertDouble' },
	{ package: 'checkmate', name: 'assert_environment' },
	{ package: 'checkmate', name: 'assertEnvironment' },
	{ package: 'checkmate', name: 'assert_factor' },
	{ package: 'checkmate', name: 'assertFactor' },
	{ package: 'checkmate', name: 'assert_false' },
	{ package: 'checkmate', name: 'assertFalse' },
	{ package: 'checkmate', name: 'assert_file' },
	{ package: 'checkmate', name: 'assertFile' },
	{ package: 'checkmate', name: 'assert_file_exists' },
	{ package: 'checkmate', name: 'assertFileExists' },
	{ package: 'checkmate', name: 'assert_flag' },
	{ package: 'checkmate', name: 'assertFlag' },
	{ package: 'checkmate', name: 'assert_formula' },
	{ package: 'checkmate', name: 'assertFormula' },
	{ package: 'checkmate', name: 'assert_function' },
	{ package: 'checkmate', name: 'assertFunction' },
	{ package: 'checkmate', name: 'assert_int' },
	{ package: 'checkmate', name: 'assertInt' },
	{ package: 'checkmate', name: 'assert_integer' },
	{ package: 'checkmate', name: 'assertInteger' },
	{ package: 'checkmate', name: 'assert_list' },
	{ package: 'checkmate', name: 'assertList' },
	{ package: 'checkmate', name: 'assert_logical' },
	{ package: 'checkmate', name: 'assertLogical' },
	{ package: 'checkmate', name: 'assert_matrix' },
	{ package: 'checkmate', name: 'assertMatrix' },
	{ package: 'checkmate', name: 'assert_multi_class' },
	{ package: 'checkmate', name: 'assertMultiClass' },
	{ package: 'checkmate', name: 'assert_named' },
	{ package: 'checkmate', name: 'assertNamed' },
	{ package: 'checkmate', name: 'assert_names' },
	{ package: 'checkmate', name: 'assertNames' },
	{ package: 'checkmate', name: 'assert_null' },
	{ package: 'checkmate', name: 'assertNull' },
	{ package: 'checkmate', name: 'assert_number' },
	{ package: 'checkmate', name: 'assertNumber' },
	{ package: 'checkmate', name: 'assert_numeric' },
	{ package: 'checkmate', name: 'assertNumeric' },
	{ package: 'checkmate', name: 'assert_os' },
	{ package: 'checkmate', name: 'assertOs' },
	{ package: 'checkmate', name: 'assert_path_for_output' },
	{ package: 'checkmate', name: 'assertPathForOutput' },
	{ package: 'checkmate', name: 'assert_permutation' },
	{ package: 'checkmate', name: 'assertPermutation' },
	{ package: 'checkmate', name: 'assert_posixct' },
	{ package: 'checkmate', name: 'assertPOSIXct' },
	{ package: 'checkmate', name: 'assert_r6' },
	{ package: 'checkmate', name: 'assertR6' },
	{ package: 'checkmate', name: 'assert_raw' },
	{ package: 'checkmate', name: 'assertRaw' },
	{ package: 'checkmate', name: 'assert_scalar' },
	{ package: 'checkmate', name: 'assertScalar' },
	{ package: 'checkmate', name: 'assert_scalar_na' },
	{ package: 'checkmate', name: 'assertScalarNA' },
	{ package: 'checkmate', name: 'assert_set_equal' },
	{ package: 'checkmate', name: 'assertSetEqual' },
	{ package: 'checkmate', name: 'assert_string' },
	{ package: 'checkmate', name: 'assertString' },
	{ package: 'checkmate', name: 'assert_subset' },
	{ package: 'checkmate', name: 'assertSubset' },
	{ package: 'checkmate', name: 'assert_tibble' },
	{ package: 'checkmate', name: 'assertTibble' },
	{ package: 'checkmate', name: 'assert_true' },
	{ package: 'checkmate', name: 'assertTrue' },
	{ package: 'checkmate', name: 'assert_vector' },
	{ package: 'checkmate', name: 'assertVector' }
	 */
];
