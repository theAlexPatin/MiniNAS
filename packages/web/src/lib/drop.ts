/** Recursively read all entries from a FileSystemDirectoryReader. */
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
	return new Promise((resolve) => {
		const all: FileSystemEntry[] = []
		function read() {
			reader.readEntries((entries) => {
				if (entries.length === 0) {
					resolve(all)
				} else {
					all.push(...entries)
					read() // readEntries may not return everything in one call
				}
			})
		}
		read()
	})
}

/** Walk a dropped DataTransfer, preserving folder structure via webkitRelativePath. */
export async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
	const items = Array.from(dataTransfer.items)
	const entries = items
		.map((item) => item.webkitGetAsEntry?.())
		.filter((entry): entry is FileSystemEntry => entry != null)

	const hasDirectory = entries.some((e) => e.isDirectory)
	if (!hasDirectory) {
		return Array.from(dataTransfer.files)
	}

	const files: File[] = []

	async function walk(entry: FileSystemEntry, pathPrefix: string) {
		if (entry.isFile) {
			const fileEntry = entry as FileSystemFileEntry
			const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject))
			Object.defineProperty(file, 'webkitRelativePath', {
				value: pathPrefix + file.name,
				configurable: true,
			})
			files.push(file)
		} else if (entry.isDirectory) {
			const dirEntry = entry as FileSystemDirectoryEntry
			const children = await readAllEntries(dirEntry.createReader())
			for (const child of children) {
				await walk(child, pathPrefix + entry.name + '/')
			}
		}
	}

	for (const entry of entries) {
		await walk(entry, '')
	}
	return files
}
