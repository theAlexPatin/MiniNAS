import { useCallback, useRef, useState } from 'react'

export function useSelection() {
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const lastToggled = useRef<string | null>(null)

	const toggle = useCallback((path: string) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(path)) {
				next.delete(path)
			} else {
				next.add(path)
			}
			return next
		})
		lastToggled.current = path
	}, [])

	const selectRange = useCallback((paths: string[]) => {
		setSelected((prev) => {
			const next = new Set(prev)
			for (const p of paths) {
				next.add(p)
			}
			return next
		})
		if (paths.length > 0) {
			lastToggled.current = paths[paths.length - 1]
		}
	}, [])

	const selectAll = useCallback((paths: string[]) => {
		setSelected(new Set(paths))
	}, [])

	const clear = useCallback(() => {
		setSelected(new Set())
		lastToggled.current = null
	}, [])

	const isSelected = useCallback((path: string) => selected.has(path), [selected])

	return {
		selected,
		toggle,
		selectRange,
		selectAll,
		clear,
		isSelected,
		count: selected.size,
		lastToggled: lastToggled.current,
	}
}
