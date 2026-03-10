import { describe } from 'vitest';
import { DomainMatchingType, IntervalTests, testIntervalDomain } from './interval';

describe('Thesis example', () => {
	describe('unreachable statement', () => {
		testIntervalDomain(`
			x <- Inf
			if (unknown) {
				x <- -Inf
			}
			a <- 0.5 * sin(x) + 4
			b <- 2 * log(a)
			
			if (a < b) {
				result <- a
			} else {
				result <- b
			}
			print(result)
		`, {
			'5@x':       { domain: IntervalTests.interval(-Infinity, Infinity) },
			'5@a':       { domain: IntervalTests.interval(3.5, 4.5), matching: DomainMatchingType.Overapproximation },
			'6@b':       { domain: IntervalTests.interval(2 * Math.log(3.5), 2 * Math.log(4.5)), matching: DomainMatchingType.Overapproximation },
			'9@result':  { domain: IntervalTests.bottom(), matching: DomainMatchingType.Overapproximation },
			'11@result': { domain: IntervalTests.interval(2 * Math.log(3.5), 2 * Math.log(4.5)), matching: DomainMatchingType.Overapproximation },
			'13@result': { domain: IntervalTests.interval(2 * Math.log(3.5), 2 * Math.log(4.5)), matching: DomainMatchingType.Overapproximation }
		});
	});

	describe('binary search', () => {
		testIntervalDomain(`
			vec <- c(1, 4, 6, 8)
			value <- 4
			result <- -1
			low <- 1
			high <- length(vec)
			while (low <= high) {
				mid <- floor((low + high) / 2)
				if (mid > length(vec)) {
					result <- -1
					break()
				}
				if (vec[mid] == value) {
					result <- mid
					break()
				} else if (vec[mid] < value) {
					low <- mid + 1
				} else {
					high <- mid - 1
				}
			}
			cat(result, low, high)
		`, {
			'3@result':  { domain: IntervalTests.scalar(-1) },
			'4@low':     { domain: IntervalTests.scalar(1) },
			'5@high':    { domain: IntervalTests.interval(0, Infinity) },
			'6@low':     { domain: IntervalTests.interval(1, Infinity), matching: DomainMatchingType.Overapproximation },
			'6@high':    { domain: IntervalTests.interval(1, Infinity), matching: DomainMatchingType.Overapproximation },
			'7@mid':     { domain: IntervalTests.interval(1, Infinity), matching: DomainMatchingType.Overapproximation },
			'9@result':  { domain: IntervalTests.scalar(-1) },
			'13@result': { domain: IntervalTests.interval(1, Infinity), matching: DomainMatchingType.Overapproximation },
			'16@low':    { domain: IntervalTests.interval(2, Infinity), matching: DomainMatchingType.Overapproximation },
			'18@high':   { domain: IntervalTests.interval(0, Infinity), matching: DomainMatchingType.Overapproximation },
			'21@result': { domain: IntervalTests.interval(-1, Infinity), matching: DomainMatchingType.Overapproximation },
			'21@low':    { domain: IntervalTests.interval(1, Infinity), matching: DomainMatchingType.Overapproximation },
			'21@high':   { domain: IntervalTests.interval(0, Infinity), matching: DomainMatchingType.Overapproximation }
		});
	});
});