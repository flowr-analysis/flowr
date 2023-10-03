import { withShell } from '../../helper/shell'
import { testForFeatureForInput } from '../statistics.spec'


describe('Loops', withShell(shell => {
	testForFeatureForInput(shell, 'loops', [
		{
			name:     'no control loops',
			code:     'a <- 1; 4 * x; foo(a) # while(FALSE) {} ',
			expected: {},
			written:  'nothing'
		},
		{
			name:     'one while loop, with a break',
			code:     'while(TRUE) { print(3); break }',
			expected: {
				whileLoops:      1,
				breakStatements: 1
			},
			// records only implicit and nested loops
			written: 'nothing'
		},
		{
			name:     'one for loop, with a next',
			code:     'for(i in 1:10) { print(9); next }',
			expected: {
				forLoops:       1,
				nextStatements: 1
			},
			written: 'nothing'
		},
		{
			name:     'one repeat loop, with multiple breaks, and nexts',
			code:     'repeat { print(9); if(runif(3) > 0.5) { break } else { if(runif(3) > 0.5) next else break }; next }',
			expected: {
				repeatLoops:     1,
				breakStatements: 2,
				nextStatements:  2
			},
			written: 'nothing'
		},
		{
			name:     'simply nested while loops',
			code:     'while(TRUE) { while(FALSE) { print(3) } }',
			expected: {
				whileLoops:             2,
				nestedExplicitLoops:    1,
				deepestExplicitNesting: 1
			},
			written: [
				['nested-loop', [{ value: 'while(FALSE) { print(3) }' }]],
			]
		},
		{
			name: 'using implicit loops',
			code: `
			apply(x, 2, f)
			lapply(x, f)
			sapply(x, f)
			vapply(x, f)
			tapply(x, f)
			mapply(x, f)
			`,
			expected: {
				implicitLoops: 6
			},
			written: [
				['implicit-loop', [{ value: 'apply(x, 2, f)' }, { value: 'lapply(x, f)' }, { value: 'sapply(x, f)' }, { value: 'vapply(x, f)' }, { value: 'tapply(x, f)' }, { value: 'mapply(x, f)' }]],
			]
		},
		{
			name: 'many nested loops',
			code: `
				while(TRUE) {
					while(FALSE) {
					  for(i in 1:10) {
					    repeat { }
					  }
					}
					for(j in 1:10) { while(x) { } }
					repeat { while(FALSE) {} }
			  }
			  for(k in x:3) { repeat { } }
			`,
			expected: {
				whileLoops:             4,
				forLoops:               3,
				repeatLoops:            3,
				nestedExplicitLoops:    8,
				deepestExplicitNesting: 3
			},
			written: [
				['nested-loop', [
					{ value: 'while(FALSE) {\nfor(i in 1:10) {\nrepeat { }\n}\n}' },
					{ value: 'for(i in 1:10) {\nrepeat { }\n}' },
					{ value: 'repeat { }' },
					{ value: 'for(j in 1:10) { while(x) { } }' },
					{ value: 'while(x) { }' },
					{ value: 'repeat { while(FALSE) {} }'},
					{ value: 'while(FALSE) {}' },
					{ value: 'repeat { }' },
				]]
			]
		},
	])
}))

