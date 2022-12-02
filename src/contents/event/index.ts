function toGithub1s () {
  if (!window) {
    return;
  }

  window.open(`${`https://github1s.com${window.location.pathname}`}`);
}

export {
  toGithub1s
}