import { useEffect, useState } from 'react'

import { sendRuntimeMessage } from '@/utils/messaging'
import { networkFeaturesEnabled } from '@/utils/settings'
import Switch from '@/ui/Switch'

export default function NetworkFeaturesSwitch() {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true

    networkFeaturesEnabled.getValue().then((value) => {
      if (active) setEnabled(value)
    })

    const unwatch = networkFeaturesEnabled.watch((value) => {
      if (active) setEnabled(value)
    })

    return () => {
      active = false
      unwatch()
    }
  }, [])

  const toggle = async (checked: boolean) => {
    if (busy) return

    const previous = enabled
    setEnabled(checked)
    setBusy(true)

    try {
      const status = await sendRuntimeMessage({
        type: 'set-network-features-enabled',
        enabled: checked,
      })
      setEnabled(status.enabled ?? checked)
    } catch (error) {
      console.warn('[DevGo] toggle network features failed:', error)
      setEnabled(previous)
    } finally {
      setBusy(false)
    }
  }

  return <Switch checked={enabled} disabled={busy} onChange={toggle} />
}
