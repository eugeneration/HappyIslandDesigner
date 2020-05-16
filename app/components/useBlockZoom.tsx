import React from "react";

export default function useBlockZoom() {

  var [ref, setRef] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    return () => {
      ref?.removeEventListener('wheel', handleScroll);
    };
  }, [ref]);

  function handleScroll(event: MouseWheelEvent) {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  }

  return (element: HTMLElement | null) => {
    setRef(element);
    element?.addEventListener('wheel', handleScroll);
  }
}
