import { isHasReadmeDom } from '../utils/is';

function toGithub1s () {
  if (!window || !isHasReadmeDom()) {
    return;
  }

  window.open(`${`https://github1s.com${window.location.pathname}`}`);
}

export {
  toGithub1s
}