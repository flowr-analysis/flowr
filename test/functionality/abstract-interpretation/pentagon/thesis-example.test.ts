import { describe } from 'vitest';
import { testPentagonDomain, UpperBoundsTests } from './pentagon';
import { DomainMatchingType, IntervalTests } from '../interval/interval';

describe('Thesis example', () => {
	describe('unreachable statement', () => {
		testPentagonDomain(`
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
			'5@x':       { interval: IntervalTests.interval(-Infinity, Infinity), upperBounds: UpperBoundsTests.top() },
			'5@a':       { interval: IntervalTests.interval(3.5, 4.5), upperBounds: UpperBoundsTests.top() },
			'6@b':       { interval: IntervalTests.interval(2 * Math.log(3.5), 2 * Math.log(4.5)), upperBounds: UpperBoundsTests.bounds(['5@a']) },
			'9@result':  { interval: IntervalTests.bottom(), upperBounds: UpperBoundsTests.bounds(['8@b']) },
			'11@result': { interval: IntervalTests.interval(2 * Math.log(3.5), 2 * Math.log(4.5)), upperBounds: UpperBoundsTests.bounds(['8@a', '8@b']) },
			'13@result': { interval: IntervalTests.interval(2 * Math.log(3.5), 2 * Math.log(4.5)), upperBounds: UpperBoundsTests.bounds(['8@a', '8@b']), lowerBounds: UpperBoundsTests.bounds(['8@b'], ['8@a']) },
		});
	});

	describe('binary search', () => {
		testPentagonDomain(`
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
			'3@result':  { interval: IntervalTests.scalar(-1), upperBounds: UpperBoundsTests.top() },
			'4@low':     { interval: IntervalTests.scalar(1), upperBounds: UpperBoundsTests.top(), lowerBounds: UpperBoundsTests.bounds(['3@result']) },
			'5@high':    { interval: IntervalTests.interval(0, Infinity), upperBounds: UpperBoundsTests.top(), lowerBounds: UpperBoundsTests.bounds(['3@result']) },
			'6@low':     { interval: IntervalTests.interval(1, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.bounds(['6@high']), lowerBounds: UpperBoundsTests.bounds(['3@result']) },
			'6@high':    { interval: IntervalTests.interval(1, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.bounds(['3@result']), lowerBounds: UpperBoundsTests.bounds(['6@low']) },
			'7@mid':     { interval: IntervalTests.interval(1, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top(), lowerBounds: UpperBoundsTests.bounds(['3@result']) },
			'9@result':  { interval: IntervalTests.bottom(), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.bottom() },
			'13@result': { interval: IntervalTests.interval(1, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.bounds(['13@mid']), lowerBounds: UpperBoundsTests.bounds(['13@mid']) },
			'16@low':    { interval: IntervalTests.interval(2, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.bounds([], ['6@high', '16@mid']), lowerBounds: UpperBoundsTests.bounds(['16@mid']) },
			'18@high':   { interval: IntervalTests.interval(0, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.bounds(['18@mid']), lowerBounds: UpperBoundsTests.bounds([], ['18@mid']) },
			'21@result': { interval: IntervalTests.interval(-1, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top() },
			'21@low':    { interval: IntervalTests.interval(1, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top() },
			'21@high':   { interval: IntervalTests.interval(0, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top() }
		});
	});
});