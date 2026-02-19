import { bench } from 'vitest';
import { arrayEqual, arraySum } from '../../../src/util/collections/arrays';


bench('arrayEqual', () => {
	const a = new Array(100000).fill(0);
	const b = new Array(100000).fill(0);
	arrayEqual(a, b);
});
bench('arraySum', () => {
	const a = new Array(100000).fill(0);
	arraySum(a);
});
