import type Parser from 'web-tree-sitter';


/**
 *  Computes a single minimal change region ({@link Parser.Edit}) that contains all modifications.
 *  @param oldContent - The original content.
 *  @param newContent - The changed content.
 */
export function computeEditRegion(oldContent: string, newContent: string): Parser.Edit {
	const oldLen = oldContent.length;
	const newLen = newContent.length;

	// 1) Longest common prefix
	let startIndex = 0;
	while(
		startIndex < oldLen &&
		startIndex < newLen &&
		oldContent[startIndex] === newContent[startIndex]
	) {
		startIndex++;
	}

	// 2) Longest common suffix, without overlapping the prefix
	let oldSuffixIndex = oldLen;
	let newSuffixIndex = newLen;
	while(
		oldSuffixIndex > startIndex &&
		newSuffixIndex > startIndex &&
		oldContent[oldSuffixIndex - 1] === newContent[newSuffixIndex - 1]
	) {
		oldSuffixIndex--;
		newSuffixIndex--;
	}

	const oldEndIndex = oldSuffixIndex;
	const newEndIndex = newSuffixIndex;
	const [startPosition, oldEndPosition] = indexesToPoints(oldContent, [startIndex, oldEndIndex]);
	const [newEndPosition] = indexesToPoints(newContent, [newEndIndex]);

	return {
		startIndex,
		oldEndIndex,
		newEndIndex,
		startPosition,
		oldEndPosition,
		newEndPosition,
	};
}


function indexesToPoints(text: string, orderedIndexes: readonly number[]): Parser.Point[] {
	let row = 0;
	let column = 0;
	let currentIndex = 0;
	const points: Parser.Point[] = [];

	for(const targetIndex of orderedIndexes) {
		while(currentIndex < targetIndex) {
			if(text[currentIndex] === '\n') {
				row++;
				column = 0;
			} else {
				column++;
			}
			currentIndex++;
		}

		points.push({ row, column });
	}

	return points;
}