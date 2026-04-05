import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { embedFonts } from '@/export/embedFonts';

describe('embedFonts', () => {
  const elements: HTMLElement[] = [];

  function createElement(): HTMLElement {
    const el = document.createElement('div');
    document.body.appendChild(el);
    elements.push(el);
    return el;
  }

  /** Mock fetch to return a fresh Response with fake font data on each call */
  function mockFetchOk(bytes = 8) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(new ArrayBuffer(bytes), { status: 200 });
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const el of elements) {
      el.parentNode?.removeChild(el);
    }
    elements.length = 0;
  });

  it('injects a <style> element with @font-face rules when fonts load', async () => {
    const container = createElement();
    mockFetchOk();

    await embedFonts(container);

    const style = container.querySelector('style');
    expect(style).toBeTruthy();
    expect(style!.textContent).toContain('@font-face');
    expect(style!.textContent).toContain("font-family: 'Inter'");
    expect(style!.textContent).toContain("font-family: 'Monaspace Argon'");
    expect(style!.textContent).toContain('data:font/woff2;base64,');
  });

  it('injects style as first child of container', async () => {
    const container = createElement();
    const existingChild = document.createElement('div');
    container.appendChild(existingChild);

    mockFetchOk(4);

    await embedFonts(container);

    expect(container.firstChild).toBeInstanceOf(HTMLStyleElement);
  });

  it('handles fetch failures gracefully (no style injected)', async () => {
    const container = createElement();

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    await embedFonts(container);

    const style = container.querySelector('style');
    expect(style).toBeNull();
  });

  it('handles non-ok responses gracefully', async () => {
    const container = createElement();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(null, { status: 404 });
    });

    await embedFonts(container);

    const style = container.querySelector('style');
    expect(style).toBeNull();
  });

  it('fetches all three font files', async () => {
    const container = createElement();
    const fetchSpy = mockFetchOk(4);

    await embedFonts(container);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy).toHaveBeenCalledWith('/fonts/inter/InterVariable.woff2');
    expect(fetchSpy).toHaveBeenCalledWith('/fonts/monaspace-argon/MonaspaceArgon-Regular.woff2');
    expect(fetchSpy).toHaveBeenCalledWith('/fonts/monaspace-argon/MonaspaceArgon-Medium.woff2');
  });

  it('includes correct font weights in rules', async () => {
    const container = createElement();
    mockFetchOk(4);

    await embedFonts(container);

    const style = container.querySelector('style');
    expect(style!.textContent).toContain('font-weight: 100 700');
    expect(style!.textContent).toContain('font-weight: 400');
    expect(style!.textContent).toContain('font-weight: 500');
  });

  it('still embeds partial fonts when some fetches fail', async () => {
    const container = createElement();

    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Network error');
      }
      return new Response(new ArrayBuffer(4), { status: 200 });
    });

    await embedFonts(container);

    const style = container.querySelector('style');
    expect(style).toBeTruthy();
    // Should have 2 @font-face rules (the third failed)
    const matches = style!.textContent!.match(/@font-face/g);
    expect(matches).toHaveLength(2);
  });
});
