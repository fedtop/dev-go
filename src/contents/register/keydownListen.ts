import { keyCodeEnums } from '../../enum/commandEnum'
import { toGithub1s } from '../event'

const keyCodeEventMap: Record<string, () => void> = {
  [keyCodeEnums.Comma]: toGithub1s,
}

const keyDownListen = () => {
  window.addEventListener('keydown', (e) => {
    const isHasSetKey = keyCodeEnums.Comma === e.code;

    if (!isHasSetKey) return

    keyCodeEventMap[e.code]()
  })
}

export default keyDownListen
