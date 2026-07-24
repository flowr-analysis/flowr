import type { FunctionInfo } from './function-info';
import type { LinkToLastCall, LinkToNestedCall } from '../../call-context-query/call-context-query-format';

export const ExpectFunctions: LinkToNestedCall = {
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
		/* testit */
		'assert|' +
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
	{ package: 'testthat', name: 'test_that', argName: 'desc',        argIdx: 0, resolveValue: true, linkTo: [ExpectFunctions, ContextFunctions] },
	{ package: 'testthat', name: 'describe',  argName: 'description', argIdx: 0, resolveValue: true, linkTo: [ExpectFunctions, ContextFunctions] },
	{ package: 'testthat', name: 'it',        argName: 'description', argIdx: 0, resolveValue: true, linkTo: [ExpectFunctions, ContextFunctions] },
	{ package: 'testthat', name: 'test_file' },
	{ package: 'testthat', name: 'test_dir' },
	{ package: 'testthat', name: 'test_package' },
	{ package: 'tinytest', name: 'run_test_dir' },
	{ package: 'tinytest', name: 'run_test_file' },
	{ package: 'tinytest', name: 'test_all' },
	{ package: 'tinytest', name: 'test_package' },
	{ package: 'testit',   name: 'test_pkg' },
	{ package: 'RUnit',    name: 'runTestSuite' },
	{ package: 'RUnit',    name: 'runTestFile' },
	{ package: 'RUnit',    name: 'defineTestSuite' },
];
