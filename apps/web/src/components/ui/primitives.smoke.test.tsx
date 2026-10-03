import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Kbd } from "./kbd";
import { Sheet, SheetTrigger } from "./sheet";
import { Skeleton } from "./skeleton";
import { Slider } from "./slider";

test("button renders as a clickable element", () => {
  render(<Button>Apply filters</Button>);
  expect(screen.getByRole("button", { name: "Apply filters" })).toBeDefined();
});

test("checkbox renders as an unchecked checkbox by default", () => {
  render(<Checkbox aria-label="Single player" />);
  const checkbox = screen.getByRole("checkbox", { name: "Single player" });
  expect(checkbox.getAttribute("aria-checked")).toBe("false");
});

test("slider renders with its configured value", () => {
  render(<Slider defaultValue={[50]} max={100} />);
  expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("50");
});

test("sheet renders a closed trigger", () => {
  render(
    <Sheet>
      <SheetTrigger>Open filters</SheetTrigger>
    </Sheet>,
  );
  expect(
    screen
      .getByRole("button", { name: "Open filters" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
});

test("skeleton renders as a placeholder block", () => {
  const { container } = render(<Skeleton data-testid="cover-skeleton" />);
  expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
});

test("kbd renders a keyboard key", () => {
  render(<Kbd>/</Kbd>);
  expect(screen.getByText("/").tagName).toBe("KBD");
});
