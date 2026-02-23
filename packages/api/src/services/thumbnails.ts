import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { config } from '../config.js'

// Ensure thumbnail directory exists
fs.mkdirSync(config.thumbnailDir, { recursive: true })

const SIZES = {
	small: 128,
	medium: 256,
	large: 512,
} as const

export type ThumbnailSize = keyof typeof SIZES

function thumbnailPath(volumeId: string, filePath: string, size: ThumbnailSize): string {
	const hash = crypto.createHash('md5').update(`${volumeId}:${filePath}`).digest('hex')
	return path.join(config.thumbnailDir, `${hash}-${size}.webp`)
}

export function hasThumbnail(
	volumeId: string,
	filePath: string,
	size: ThumbnailSize = 'small',
): boolean {
	return fs.existsSync(thumbnailPath(volumeId, filePath, size))
}

export async function generateImageThumbnail(
	sourcePath: string,
	volumeId: string,
	filePath: string,
	size: ThumbnailSize = 'small',
): Promise<string> {
	const outPath = thumbnailPath(volumeId, filePath, size)

	if (fs.existsSync(outPath)) return outPath

	const dimension = SIZES[size]
	await sharp(sourcePath)
		.resize(dimension, dimension, { fit: 'cover', position: 'centre' })
		.webp({ quality: 80 })
		.toFile(outPath)

	return outPath
}

export async function generateVideoThumbnail(
	sourcePath: string,
	volumeId: string,
	filePath: string,
	size: ThumbnailSize = 'small',
): Promise<string> {
	const outPath = thumbnailPath(volumeId, filePath, size)

	if (fs.existsSync(outPath)) return outPath

	const dimension = SIZES[size]
	const tempPath = `${outPath}.tmp.png`

	await new Promise<void>((resolve, reject) => {
		ffmpeg(sourcePath)
			.screenshots({
				timestamps: ['5%'],
				filename: path.basename(tempPath),
				folder: path.dirname(tempPath),
				size: `${dimension}x?`,
			})
			.on('end', resolve)
			.on('error', reject)
	})

	// Convert to webp
	if (fs.existsSync(tempPath)) {
		await sharp(tempPath)
			.resize(dimension, dimension, { fit: 'cover', position: 'centre' })
			.webp({ quality: 80 })
			.toFile(outPath)
		fs.unlinkSync(tempPath)
	}

	return outPath
}

export async function getThumbnailPath(
	sourcePath: string,
	volumeId: string,
	filePath: string,
	mimeType: string | null,
	size: ThumbnailSize = 'small',
): Promise<string | null> {
	const cached = thumbnailPath(volumeId, filePath, size)
	if (fs.existsSync(cached)) return cached

	if (!mimeType) return null

	try {
		if (mimeType.startsWith('image/')) {
			return await generateImageThumbnail(sourcePath, volumeId, filePath, size)
		}
		if (mimeType.startsWith('video/')) {
			return await generateVideoThumbnail(sourcePath, volumeId, filePath, size)
		}
	} catch (err) {
		console.error(`Thumbnail generation failed for ${filePath}:`, err)
	}

	return null
}
