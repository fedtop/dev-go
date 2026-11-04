import { useEffect, useState } from 'react'

/**
 * 读取各命令当前绑定的快捷键（命令名 → manifest 风格组合键，未绑定为空串）。
 * 用户可能在另一个标签页的 chrome://extensions/shortcuts 修改，页面重新获得焦点时重新读取。
 */
export function useCommandShortcuts(): Record<string, string> {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    const load = () => {
      void browser.commands?.getAll().then((commands) => {
        if (!active) return
        setShortcuts(
          Object.fromEntries(
            commands.map((command) => [command.name ?? '', command.shortcut ?? '']),
          ),
        )
      })
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }

    load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return shortcuts
}
