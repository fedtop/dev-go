import { useEffect, useMemo } from 'react';
import registerKeyDownListen from '../register/keydownListen';

const useGitHub = () => {

  useEffect(() => {
    registerKeyDownListen();
  }, [])

  const isCodePage = useMemo<boolean>(() => {
    const url = window.location.href;
    const fileNavigation = document.querySelectorAll('.file-navigation');
    const isHasBlob = url.includes('/blob/');
    const isHasTree = url.includes('/tree/');

    return  fileNavigation.length > 0 || isHasBlob || isHasTree;
  }, [])

  return {
    isCodePage,
  }
}

export {
  useGitHub
}