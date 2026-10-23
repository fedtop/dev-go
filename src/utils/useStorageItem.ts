import { useCallback, useEffect, useState } from 'react'

/** WXT storage item 的最小结构（避免依赖内部类型） */
interface StorageItemLike<T> {
  fallback: T
  getValue(): Promise<T>
  setValue(value: T): Promise<void>
  watch(callback: (newValue: T) => void): () => void
}

/**
 * 把 storage item 绑定为 React 状态：读取初始值、跨页面实时同步，写入即持久化。
 * @returns [当前值, 写入函数, 是否已读取到存储值]
 */
export function useStorageItem<T>(item: StorageItemLike<T>): [T, (value: T) => void, boolean] {
  const [value, setValue] = useState<T>(item.fallback)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    item.getValue().then((stored) => {
      if (!active) return
      setValue(stored)
      setLoaded(true)
    })
    const unwatch = item.watch((next) => setValue(next ?? item.fallback))
    return () => {
      active = false
      unwatch()
    }
  }, [item])

  const update = useCallback(
    (next: T) => {
      setValue(next)
      void item.setValue(next)
    },
    [item],
  )

  return [value, update, loaded]
}
