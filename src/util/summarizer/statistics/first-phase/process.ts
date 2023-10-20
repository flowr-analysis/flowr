import fs from 'node:fs'
import path from 'node:path'
import { guard } from '../../../assert'
import { StatisticsOutputFormat } from '../../../../statistics'

export class FileMigrator {
	private readonly writeHandles = new Map<string, fs.WriteStream>()
	private finished = false

	public async migrate(sourceFolderContent: Map<string,string>, targetFolder: string): Promise<void> {
		guard(!this.finished, () => 'migrator is already marked as finished!')
		if(!fs.existsSync(targetFolder)) {
			fs.mkdirSync(targetFolder, { recursive: true })
		}

		await Promise.all<Promise<void>[]>([...sourceFolderContent.entries()].map(([filepath, content]) => {
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
			return new Promise((resolve, reject) => {
				// before we write said content we have to group {value: string, context: string} by context (while we can safely assume that there is only one context per file,
				// i want to be sure
				const group = groupByContext(content).map(s => JSON.stringify(s)).join('\n');
				(targetStream as fs.WriteStream).write(group, 'utf-8', err => {
					if(err) {
						reject(err)
					} else {
						resolve()
					}
				})
			})
		}))
	}

	public finish() {
		for(const handle of this.writeHandles.values()) {
			handle.close()
		}
		this.finished = true
	}
}

function groupByContext(input: string | undefined): StatisticsOutputFormat<never[]>[] {
	if(input === undefined) {
		return []
	}
	const parsed = input.split('\n').filter(s => s && s !== '').map(s => JSON.parse(s) as StatisticsOutputFormat<never>)
	const grouped = new Map<string|undefined, never[]>()
	for(const content of parsed) {
		if(!Array.isArray(content)) {
			// in this case it is a meta file or other which does not have to be grouped
			return parsed
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
