import { RefObject, useEffect } from 'react';

type ClickOutsideEventName = 'click' | 'mousedown';

export const useClickOutside = <T extends HTMLElement>(
    elementRef: RefObject<T>,
    onClickOutside: () => void,
    eventName: ClickOutsideEventName = 'mousedown'
) => {
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const targetNode = event.target as Node | null;
            if (!targetNode || !elementRef.current) {
                return;
            }

            if (!elementRef.current.contains(targetNode)) {
                onClickOutside();
            }
        };

        document.addEventListener(eventName, handleClickOutside);
        return () => {
            document.removeEventListener(eventName, handleClickOutside);
        };
    }, [elementRef, eventName, onClickOutside]);
};
