import fs from 'node:fs'
import path from 'node:path'
import { guard } from '../../../assert'
import { StatisticsOutputFormat } from '../../../../statistics'

export class FileMigrator {
	private readonly writeHandles = new Map<string, fs.WriteStream>()
	private finished = false

	public async migrate(sourceFolderContent: Map<string,string>, targetFolder: string, originalFile: string | undefined): Promise<void> {
		guard(!this.finished, () => 'migrator is already marked as finished!')
		if(!fs.existsSync(targetFolder)) {
			fs.mkdirSync(targetFolder, { recursive: true })
		}

		const promises: Promise<void>[] = []
		for(const [filepath, content] of sourceFolderContent.entries()) {
			const target = path.join(targetFolder, filepath)

			// TODO: is there a faster way ?
			let targetStream = this.writeHandles.get(target)
			if(targetStream === undefined) {
				if(!fs.existsSync(path.dirname(target))) {
					fs.mkdirSync(path.dirname(target), { recursive: true })
				}
				targetStream = fs.createWriteStream(target, { flags: 'a' })
				this.writeHandles.set(target, targetStream)
			}
			// before we write said content we have to group {value: string, context: string} by context (while we can safely assume that there is only one context per file,
			// i want to be sure
			const grouped = groupByContext(content)
			let data = grouped === undefined ? content : grouped.map(s => JSON.stringify(s)).join('\n') + '\n'
			if(filepath.endsWith('meta.txt')) {
				data = `{"file":"${originalFile ?? ''}","content":${data.trimEnd()}}\n`
			}
			promises.push(new Promise((resolve, reject) => (targetStream as fs.WriteStream).write(data, 'utf-8', err => {
				if(err) {
					reject(err)
				} else {
					resolve()
				}
			})))
		}
		await Promise.all(promises)
	}

	public finish() {
		for(const handle of this.writeHandles.values()) {
			handle.close()
		}
		this.finished = true
	}
}

function groupByContext(input: string | undefined): StatisticsOutputFormat<never[]>[] | undefined {
	if(input === undefined) {
		return []
	}
	const parsed = input.split('\n').filter(s => s && s !== '').map(s => JSON.parse(s) as StatisticsOutputFormat<never>)
	const grouped = new Map<string|undefined, never[]>()
	for(const content of parsed) {
		if(!Array.isArray(content)) {
			// in this case it is a meta file or other which does not have to be grouped
			return undefined
		}
		const [value, context] = content
		const get = grouped.get(context)
		if(get === undefined) {
			grouped.set(context, [value])
		} else {
			get.push(value)
		}
	}
	return [...grouped.entries()].map(([context, values]) => [values, context])
}
