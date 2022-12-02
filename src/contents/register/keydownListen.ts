import { keyCodeEnums } from '../../enum/commandEnum';
import { toGithub1s } from '../event';

const keyCodeEventMap: Record<string, Function> = {
  [keyCodeEnums.comma]: toGithub1s
}

const keyDownListen = () => {
  window.addEventListener("keydown", function (e) {
      keyCodeEventMap[e.code]();
  })
}

export default keyDownListen;