import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { addVolume, getVolumeById, getVolumes, removeVolume } from '../../src/services/volumes.js'
import { resetDb } from '../helpers.js'

const testVolDir = join(tmpdir(), 'mininas-vol-test')

beforeEach(() => {
	resetDb()
	mkdirSync(testVolDir, { recursive: true })
})

afterAll(() => {
	try {
		rmSync(testVolDir, { recursive: true })
	} catch {}
})

describe('getVolumes', () => {
	it('returns empty array initially', () => {
		expect(getVolumes()).toEqual([])
	})

	it('returns added volumes', () => {
		addVolume('v1', 'Test Vol', testVolDir)
		const vols = getVolumes()
		expect(vols).toHaveLength(1)
		expect(vols[0]).toMatchObject({
			id: 'v1',
			label: 'Test Vol',
			path: testVolDir,
		})
	})
})

describe('getVolumeById', () => {
	it('returns null for non-existent volume', () => {
		expect(getVolumeById('nope')).toBeNull()
	})

	it('returns existing volume', () => {
		addVolume('v1', 'Test', testVolDir)
		const vol = getVolumeById('v1')
		expect(vol).not.toBeNull()
		expect(vol!.id).toBe('v1')
	})
})

describe('addVolume', () => {
	it('throws for non-existent path', () => {
		expect(() => addVolume('v1', 'Test', '/nonexistent/path/abc123')).toThrow('Path does not exist')
	})

	it('adds a volume with existing path', () => {
		addVolume('v1', 'Test', testVolDir)
		expect(getVolumeById('v1')).not.toBeNull()
	})

	it('rejects duplicate id', () => {
		addVolume('v1', 'Test', testVolDir)
		expect(() => addVolume('v1', 'Other', testVolDir)).toThrow()
	})
})

describe('removeVolume', () => {
	it('removes existing volume', () => {
		addVolume('v1', 'Test', testVolDir)
		expect(removeVolume('v1')).toBe(true)
		expect(getVolumeById('v1')).toBeNull()
	})

	it('returns false for non-existent volume', () => {
		expect(removeVolume('nope')).toBe(false)
	})
})
