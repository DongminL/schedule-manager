/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";

import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
  test("toggles between hidden and visible on each button click", () => {
    render(<PasswordInput value="secret" onChange={() => {}} />);

    const input = screen.getByDisplayValue("secret") as HTMLInputElement;
    const toggle = screen.getByRole("button");

    expect(input.type).toBe("password");

    fireEvent.click(toggle);
    expect(input.type).toBe("text");

    fireEvent.click(toggle);
    expect(input.type).toBe("password");

    fireEvent.click(toggle);
    expect(input.type).toBe("text");
  });
});
