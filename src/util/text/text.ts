import { guard } from '../assert';

/**
 *
 */
export function nth(n: number): string {
	guard(isFinite(n) && n >= 1, 'n must be a non-negative number');
	const num = String(n);
	const lastDigit = num[num.length - 1];
	switch(lastDigit) {
		case '1':
			return n > 0 && n < 20 ? `${n}th` : `${n}st`;
		case '2':
			return n > 0 && n < 20 ? `${n}th` : `${n}nd`;
		case '3':
			return n > 0 && n < 20 ? `${n}th` : `${n}rd`;
		default:
			return `${n}th`;
	}
}
