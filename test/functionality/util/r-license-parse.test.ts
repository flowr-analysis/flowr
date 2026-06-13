import { assert, describe, test } from 'vitest';
import type { RLicenseElementInfo } from '../../../src/util/r-license';
import { parseRLicense } from '../../../src/util/r-license';
import { Range } from 'semver';

describe('R license parsing', () => {
	function chk(expected: RLicenseElementInfo, ...strings: readonly string[]): void {
		test.each(strings)('parses \'%s\'', (str: string) => {
			const parse = parseRLicense(str);
			function ignoreRawStringifier(key: string, value: unknown): unknown {
				if(key === 'raw' || key === 'str') {
					return undefined;
				} else {
					return value;
				}
			}
			// we have to ignore 'raw' because they are the exact string parts
			assert.strictEqual(JSON.stringify(parse, ignoreRawStringifier), JSON.stringify(expected, ignoreRawStringifier));
		});
	}

	describe('From R Package Explanation', () => {
		chk({
			type:              'license',
			license:           'GPL',
			versionConstraint: new Range('>=2')
		}, 'GPL (>= 2)', 'GPL (>=2)', 'GPL (  >=2  )');
		chk({
			type:              'license',
			license:           'Apache License',
			versionConstraint: new Range('=2.0.0')
		}, 'Apache License (== 2.0.0)', 'Apache License (=2.0.0)');
		chk({
			type:    'license',
			license: 'GPL-2'
		}, 'GPL-2');
		chk({
			type:    'license',
			license: 'LGPL-2.1'
		}, 'LGPL-2.1');
		// WITH
		chk({
			type:        'combination',
			combination: 'with',
			elements:    [
				{
					type:    'license',
					license: 'GPL-2'
				},
				{
					type:      'exception',
					exception: 'Classpath exception'
				}
			]
		}, 'GPL-2 with Classpath exception', 'GPL-2 WITH Classpath exception');
		chk({
			type:    'license',
			license: 'Artistic-2.0'
		}, 'Artistic-2.0');
		chk({
			type:    'license',
			license: 'file LICENSE'
		}, 'file LICENSE', 'FILE LICENSE', 'File License');
		chk({
			type:        'combination',
			combination: 'and',
			elements:    [
				{
					type:    'license',
					license: 'MIT'
				},
				{
					type:    'license',
					license: 'file LICENSE'
				}
			]
		}, 'MIT + file LICENSE', 'MIT and file LICENSE', 'MIT & file LICENSE');
		chk({
			type:        'combination',
			combination: 'or',
			elements:    [
				{
					type:    'license',
					license: 'GPL-2'
				},
				{
					type:    'license',
					license: 'GPL-3'
				}
			]
		}, 'GPL-2 | GPL-3', 'GPL-2 or GPL-3');
	});
	chk({
		type:        'combination',
		combination: 'and',
		elements:    [
			{
				type:    'license',
				license: 'MIT'
			},
			{
				type:        'combination',
				combination: 'or',
				elements:    [
					{
						type:    'license',
						license: 'GPL-2'
					},
					{
						type:    'license',
						license: 'GPL-3'
					}
				]
			}
		]
	}, 'MIT and (GPL-2 or GPL-3)', 'MIT + (GPL-2 | GPL-3)', 'MIT & (GPL-2 or GPL-3)');
});