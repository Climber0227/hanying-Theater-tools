import { useEffect, useState } from 'react';

// matchMedia 断点 hook：isMobile = 视口 <= 700px（与 CSS 断点一致）
export default function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = e => setMatches(e.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);
    return matches;
}

export const MOBILE_QUERY = '(max-width: 700px)';
