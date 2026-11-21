import { assert, test } from 'vitest';
import { parseDCF, parseDCFRecords } from '../../../../src/project/plugins/file-plugins/files/flowr-description-file';

/** the shape of a repository `PACKAGES` index: one record per package, separated by blank lines */
const Packages = `Package: dplyr
Version: 1.1.4
Depends: R (>= 3.5.0)
Imports: cli (>= 3.4.0),
  glue (>= 1.3.2)

Package: tidyr
Version: 1.3.1
Imports: dplyr (>= 1.0.10)

Package: ggplot2
Version: 3.5.1
`;

test('a PACKAGES index yields one record per package, with continuation lines and comma fields split per record', () => {
	const records = parseDCFRecords(Packages);
	assert.lengthOf(records, 3);
	const [dplyr, tidyr] = records;
	assert.deepEqual(records.map(r => r.get('Package')?.[0]), ['dplyr', 'tidyr', 'ggplot2']);
	assert.deepEqual(records.map(r => r.get('Version')?.[0]), ['1.1.4', '1.3.1', '3.5.1']);
	assert.deepEqual(dplyr.get('Imports'), ['cli (>= 3.4.0)', 'glue (>= 1.3.2)']);
	assert.deepEqual(dplyr.get('Depends'), ['R (>= 3.5.0)']);
	assert.deepEqual(tidyr.get('Imports'), ['dplyr (>= 1.0.10)']);
	assert.isUndefined(tidyr.get('Depends'), 'a field of the record before must not leak in');
});

test('the `.`-only separator R also allows ends a record, and an empty input yields none', () => {
	assert.lengthOf(parseDCFRecords('Package: a\n.\nPackage: b\n'), 2);
	assert.lengthOf(parseDCFRecords(''), 0);
	assert.lengthOf(parseDCFRecords('\n\n  \n'), 0);
});

test('a DESCRIPTION is one record even across blank lines, and a leading BOM does not swallow the first field', () => {
	const dcf = parseDCF('Package: mypkg\n\nVersion: 1.0\n');
	assert.deepEqual(dcf.get('Package'), ['mypkg']);
	assert.deepEqual(dcf.get('Version'), ['1.0']);
	assert.deepEqual(parseDCF('﻿Package: mypkg\n').get('Package'), ['mypkg']);
	assert.deepEqual(parseDCFRecords('﻿Package: mypkg\n')[0].get('Package'), ['mypkg']);
});
