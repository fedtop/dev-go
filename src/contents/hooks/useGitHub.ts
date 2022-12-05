import { useEffect, useMemo } from 'react'

import { isGithubCodePage } from '../utils/is'
import registerKeyDownListen from '../register/keydownListen'

const useGitHub = () => {
  useEffect(() => {
    registerKeyDownListen()
  }, [])

  return {
    isCodePage: isGithubCodePage(),
  }
}

export { useGitHub }
