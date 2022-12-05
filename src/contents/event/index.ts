import { isGithubCodePage } from '../utils/is'

function toGithub1s() {
  if (!isGithubCodePage()) {
    return
  }

  window.open(`${`https://github1s.com${window.location.pathname}`}`)
}

export { toGithub1s }
