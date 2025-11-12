import fs from 'fs';
import path from 'path';

/* eslint-disable */
const IgnoreRegex = /[0-9]+(\.[0-9]+)? ?ms|"timing":\s*[0-9]+(\.0-9)?,?|tmp-[A-Za-z0-9-]+/g;
/* eslint-enable */

/**
 * Checks whether the file contains a different content, but ignores timing and some other non-semantic changes.
 */
function didFileChange(filePath: string, content: string): boolean {
	if(!fs.existsSync(filePath)) {
		return true; // If the file does not exist, it is considered changed.
	}
	const currentContent = fs.readFileSync(filePath, 'utf-8');

	const cleanedCurrentContent = currentContent.replace(IgnoreRegex, '');
	const cleanedNewContent = content.replace(IgnoreRegex, '');
	return cleanedCurrentContent !== cleanedNewContent;
}
/**
 * Writes the wiki documentation to the specified output path.
 * Returns true if the file was updated, false if it was unchanged.
 */
export function writeWikiTo(text: string, output_path: string, check_change = true): boolean {
	if(!check_change || didFileChange(output_path, text)) {
		fs.mkdirSync(path.dirname(output_path), { recursive: true });
		fs.writeFileSync(output_path, text, 'utf-8');
		return true;
	}
	return false;
}
