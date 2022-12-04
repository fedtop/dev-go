import type { PlasmoContentScript } from 'plasmo'

import { useGitHub } from '../../hooks/useGitHub'
import OnlineEditBtn from './components/OnlineEditBtn'

export const config: PlasmoContentScript = {
  matches: ['https://github.com/*/*'],
}

export default function FunctionPage() {
  const { isCodePage } = useGitHub()

  return <>{isCodePage && <OnlineEditBtn title='在线编辑' />}</>
}
