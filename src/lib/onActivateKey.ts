import type { KeyboardEvent } from "react";

/** Enter/Space 활성화 — role="button"을 가진 비-버튼 요소의 키보드 동등 조작. */
export function onActivateKey(activate: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };
}
