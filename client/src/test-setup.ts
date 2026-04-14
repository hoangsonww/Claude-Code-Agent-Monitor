/**
 * @file test-setup.ts
 * @description Test setup file for the client-side unit tests using Vitest and React Testing Library. This file configures the testing environment, including importing necessary libraries and performing cleanup after each test to ensure isolation between tests. The cleanup function from React Testing Library is called after each test to unmount components and clean up the DOM, preventing side effects from affecting other tests.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
