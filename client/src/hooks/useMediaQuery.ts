import { useEffect, useState } from 'react';

/**
 * CSS media query 매치 여부를 구독한다.
 *
 * @param query matchMedia에 전달할 쿼리 문자열
 * @returns 현재 매치 여부
 */
export function useMediaQuery(query: string): boolean {
  const getMatches = () => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', handleChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}
