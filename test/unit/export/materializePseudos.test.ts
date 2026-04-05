import { describe, it, expect, vi, afterEach } from 'vitest';
import { materializePseudos } from '@/export/materializePseudos';

describe('materializePseudos', () => {
  const elements: HTMLElement[] = [];

  function createElement(): HTMLElement {
    const el = document.createElement('div');
    document.body.appendChild(el);
    elements.push(el);
    return el;
  }

  afterEach(() => {
    for (const el of elements) {
      el.parentNode?.removeChild(el);
    }
    elements.length = 0;
    vi.restoreAllMocks();
  });

  /**
   * Helper to create a mock getComputedStyle that returns pseudo-element data
   * for specific element/pseudo pairs, falling back to the real implementation
   * otherwise.
   */
  function mockGetComputedStyleForPseudos(
    specs: Array<{
      element: HTMLElement;
      pseudo: string;
      props: Record<string, string>;
    }>,
  ) {
    const original = window.getComputedStyle.bind(window);

    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (el: Element, pseudoElt?: string | null) => {
        const spec = specs.find(
          (s) => s.element === el && pseudoElt === s.pseudo,
        );

        if (spec) {
          const propNames = Object.keys(spec.props);
          const result = {
            getPropertyValue: (prop: string) => spec.props[prop] ?? '',
            length: propNames.length,
          } as unknown as CSSStyleDeclaration;

          // Add indexed access
          for (let i = 0; i < propNames.length; i++) {
            (result as Record<number, string>)[i] = propNames[i];
          }

          return result;
        }

        return original(el, pseudoElt ?? undefined);
      },
    );
  }

  it('does not add spans when there are no pseudo-elements', () => {
    const original = createElement();
    const clone = original.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);
    elements.push(clone);

    materializePseudos(original, clone);

    const pseudoSpans = clone.querySelectorAll('[data-pseudo]');
    expect(pseudoSpans.length).toBe(0);
  });

  it('materializes ::before pseudo-element as first child span', () => {
    const original = createElement();
    const clone = original.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);
    elements.push(clone);

    mockGetComputedStyleForPseudos([
      {
        element: original,
        pseudo: '::before',
        props: {
          content: '""',
          display: 'block',
          position: 'absolute',
        },
      },
    ]);

    materializePseudos(original, clone);

    const beforeSpan = clone.querySelector('[data-pseudo="::before"]');
    expect(beforeSpan).toBeTruthy();
    expect(beforeSpan).toBe(clone.firstChild);
  });

  it('materializes ::after pseudo-element as last child span', () => {
    const original = createElement();
    original.innerHTML = '<span>content</span>';
    const clone = original.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);
    elements.push(clone);

    mockGetComputedStyleForPseudos([
      {
        element: original,
        pseudo: '::after',
        props: {
          content: '""',
          display: 'block',
        },
      },
    ]);

    materializePseudos(original, clone);

    const afterSpan = clone.querySelector('[data-pseudo="::after"]');
    expect(afterSpan).toBeTruthy();
    expect(afterSpan).toBe(clone.lastChild);
  });

  it('skips pseudo-elements with content: none', () => {
    const original = createElement();
    const clone = original.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);
    elements.push(clone);

    mockGetComputedStyleForPseudos([
      {
        element: original,
        pseudo: '::before',
        props: {
          content: 'none',
        },
      },
    ]);

    materializePseudos(original, clone);

    const pseudoSpans = clone.querySelectorAll('[data-pseudo]');
    expect(pseudoSpans.length).toBe(0);
  });

  it('skips pseudo-elements with display: none', () => {
    const original = createElement();
    const clone = original.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);
    elements.push(clone);

    mockGetComputedStyleForPseudos([
      {
        element: original,
        pseudo: '::before',
        props: {
          content: '""',
          display: 'none',
        },
      },
    ]);

    materializePseudos(original, clone);

    const pseudoSpans = clone.querySelectorAll('[data-pseudo]');
    expect(pseudoSpans.length).toBe(0);
  });

  it('copies computed styles to materialized span', () => {
    const original = createElement();
    const clone = original.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);
    elements.push(clone);

    mockGetComputedStyleForPseudos([
      {
        element: original,
        pseudo: '::before',
        props: {
          content: '""',
          display: 'block',
          position: 'absolute',
          'background-color': 'rgb(255, 0, 0)',
        },
      },
    ]);

    materializePseudos(original, clone);

    const span = clone.querySelector('[data-pseudo="::before"]') as HTMLElement;
    expect(span).toBeTruthy();
    expect(span.style.position).toBe('absolute');
    expect(span.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('walks child elements and materializes their pseudo-elements', () => {
    const original = createElement();
    const child = document.createElement('div');
    child.className = 'cylinder-cap';
    original.appendChild(child);

    const clone = original.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);
    elements.push(clone);

    mockGetComputedStyleForPseudos([
      {
        element: child,
        pseudo: '::after',
        props: {
          content: '""',
          display: 'block',
          'border-radius': '50%',
        },
      },
    ]);

    materializePseudos(original, clone);

    const cloneChild = clone.querySelector('.cylinder-cap') as HTMLElement;
    expect(cloneChild).toBeTruthy();
    const afterSpan = cloneChild.querySelector('[data-pseudo="::after"]');
    expect(afterSpan).toBeTruthy();
  });

  it('materializes both ::before and ::after on the same element', () => {
    const original = createElement();
    const clone = original.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);
    elements.push(clone);

    mockGetComputedStyleForPseudos([
      {
        element: original,
        pseudo: '::before',
        props: {
          content: '""',
          display: 'block',
        },
      },
      {
        element: original,
        pseudo: '::after',
        props: {
          content: '""',
          display: 'block',
        },
      },
    ]);

    materializePseudos(original, clone);

    const beforeSpan = clone.querySelector('[data-pseudo="::before"]');
    const afterSpan = clone.querySelector('[data-pseudo="::after"]');
    expect(beforeSpan).toBeTruthy();
    expect(afterSpan).toBeTruthy();
    expect(beforeSpan).toBe(clone.firstChild);
    expect(afterSpan).toBe(clone.lastChild);
  });

  it('resolves text content from pseudo-element', () => {
    const original = createElement();
    const clone = original.cloneNode(true) as HTMLElement;
    document.body.appendChild(clone);
    elements.push(clone);

    mockGetComputedStyleForPseudos([
      {
        element: original,
        pseudo: '::before',
        props: {
          content: '"→"',
          display: 'inline',
        },
      },
    ]);

    materializePseudos(original, clone);

    const span = clone.querySelector('[data-pseudo="::before"]');
    expect(span).toBeTruthy();
    expect(span!.textContent).toBe('→');
  });
});
