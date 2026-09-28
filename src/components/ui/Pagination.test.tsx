/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";

import { Pagination } from "./Pagination";

describe("Pagination", () => {
  test("renders nothing when everything fits on one page", () => {
    const { container } = render(
      <Pagination pageNo={1} totalPages={1} onNavigate={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("disables 이전 on the first page and 다음 on the last page", () => {
    render(<Pagination pageNo={1} totalPages={3} onNavigate={() => {}} />);
    const prev = screen.getByRole("button", { name: "이전" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "다음" }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
  });

  test("clicking a page number reports that page", () => {
    const onNavigate = jest.fn();
    render(<Pagination pageNo={1} totalPages={3} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(onNavigate).toHaveBeenCalledWith(2);
  });

  test("이전/다음 move relative to the current page", () => {
    const onNavigate = jest.fn();
    render(<Pagination pageNo={2} totalPages={3} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(onNavigate).toHaveBeenLastCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(onNavigate).toHaveBeenLastCalledWith(1);
  });

  test("windows page-number buttons in blocks of 5 instead of rendering every page", () => {
    render(<Pagination pageNo={1} totalPages={100} onNavigate={() => {}} />);

    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole("button", { name: String(n) })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "6" })).toBeNull();
    expect(screen.queryByRole("button", { name: "100" })).toBeNull();
  });

  test("shows the next block (6–10) once the current page moves into it", () => {
    render(<Pagination pageNo={6} totalPages={100} onNavigate={() => {}} />);

    for (const n of [6, 7, 8, 9, 10]) {
      expect(screen.getByRole("button", { name: String(n) })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "5" })).toBeNull();
    expect(screen.queryByRole("button", { name: "11" })).toBeNull();
  });

  test("shows a partial final block that stops at totalPages", () => {
    render(<Pagination pageNo={12} totalPages={12} onNavigate={() => {}} />);

    for (const n of [11, 12]) {
      expect(screen.getByRole("button", { name: String(n) })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "10" })).toBeNull();
  });
});
