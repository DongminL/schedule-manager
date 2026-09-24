/**
 * @jest-environment jsdom
 */
import { isPushSupported, isStandalone, registerPush, requestPushPermission } from "@/lib/push";

function setDisplayMode(isStandaloneMode: boolean): void {
  window.matchMedia = jest.fn().mockReturnValue({ matches: isStandaloneMode });
}

function setIosStandalone(value: boolean | undefined): void {
  Object.defineProperty(navigator, "standalone", { value, configurable: true });
}

function stubPushApis(): void {
  Object.defineProperty(window, "Notification", {
    value: { permission: "granted" },
    configurable: true,
  });
  Object.defineProperty(window, "PushManager", { value: class {}, configurable: true });
  Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
}

describe("push standalone gate", () => {
  beforeEach(() => {
    setIosStandalone(undefined);
    stubPushApis();
    global.fetch = jest.fn();
  });

  test("isStandalone is true when display-mode is standalone", () => {
    setDisplayMode(true);

    expect(isStandalone()).toBe(true);
  });

  test("isStandalone is true for iOS home-screen apps", () => {
    setDisplayMode(false);
    setIosStandalone(true);

    expect(isStandalone()).toBe(true);
  });

  test("isStandalone is false in a regular browser tab", () => {
    setDisplayMode(false);

    expect(isStandalone()).toBe(false);
  });

  test("isPushSupported is false in a regular browser tab even with push APIs", () => {
    setDisplayMode(false);

    expect(isPushSupported()).toBe(false);
  });

  test("isPushSupported is true in an installed PWA", () => {
    setDisplayMode(true);

    expect(isPushSupported()).toBe(true);
  });

  test("registerPush skips token registration in a regular browser tab", async () => {
    setDisplayMode(false);

    const result = await registerPush();

    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("requestPushPermission", () => {
  function stubPermission(permission: string, result = "granted") {
    const requestPermission = jest.fn().mockResolvedValue(result);
    Object.defineProperty(window, "Notification", {
      value: { permission, requestPermission },
      configurable: true,
    });
    return requestPermission;
  }

  beforeEach(() => {
    setIosStandalone(undefined);
    stubPushApis();
  });

  test("does not prompt in a regular browser tab", async () => {
    setDisplayMode(false);
    const requestPermission = stubPermission("default");

    await requestPushPermission();

    expect(requestPermission).not.toHaveBeenCalled();
  });

  test("prompts in an installed PWA when permission is undecided", async () => {
    setDisplayMode(true);
    const requestPermission = stubPermission("default");

    await requestPushPermission();

    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  test.each(["granted", "denied"])("does not prompt again when permission is %s", async (p) => {
    setDisplayMode(true);
    const requestPermission = stubPermission(p);

    await requestPushPermission();

    expect(requestPermission).not.toHaveBeenCalled();
  });
});
