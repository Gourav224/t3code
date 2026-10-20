import "~/index.css";

import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, onTestFinished, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { ScrollArea } from "~/components/ui/scroll-area";
import { useRememberedScroll } from "./useRememberedScroll";

function Document(props: {
  readonly path: string;
  readonly contentHeight?: number;
  readonly viewportHeight?: number;
}) {
  const ref = useRememberedScroll(props.path);
  return (
    <div style={{ height: props.viewportHeight ?? 200 }}>
      <ScrollArea>
        <div ref={ref} style={{ height: props.contentHeight ?? 2000 }} />
      </ScrollArea>
    </div>
  );
}

it("returns a remounted document to where it was scrolled, per path", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  onTestFinished(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  const show = (path: string | null) =>
    act(async () => root.render(path === null ? null : <Document key={path} path={path} />));
  const viewport = () =>
    container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;

  await show("a.md");
  viewport().scrollTop = 640;
  await show("b.md");
  expect(viewport().scrollTop).toBe(0);
  viewport().scrollTop = 120;

  await show(null);
  await show("a.md");
  expect(viewport().scrollTop).toBe(640);

  await show("b.md");
  expect(viewport().scrollTop).toBe(120);
});

it("keeps restoring while late content is still making the document taller", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  onTestFinished(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  const show = (contentHeight: number | null) =>
    act(async () =>
      root.render(
        contentHeight === null ? null : (
          <Document key="a.md" path="a.md" contentHeight={contentHeight} />
        ),
      ),
    );
  const viewport = () =>
    container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  await show(2000);
  viewport().scrollTop = 640;
  await show(null);

  // Images and other late content have not laid out yet, so the page is too short to scroll.
  await show(300);
  expect(viewport().scrollTop).toBeLessThan(640);
  await show(2000);
  await nextFrame();
  await nextFrame();
  expect(viewport().scrollTop).toBe(640);

  // Leaving before the content settles must not replace the remembered position.
  await show(null);
  await show(300);
  await show(null);
  await show(2000);
  expect(viewport().scrollTop).toBe(640);
});

function mountDocument() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  onTestFinished(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  return {
    container,
    show: (props: ComponentProps<typeof Document> | null) =>
      act(async () =>
        root.render(props === null ? null : <Document key={props.path} {...props} />),
      ),
    viewport: () => container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!,
    nextFrame: async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    },
  };
}

it("stops restoring once the user drags the scrollbar", async () => {
  const { container, show, viewport, nextFrame } = mountDocument();

  await show({ path: "a.md", contentHeight: 2000 });
  viewport().scrollTop = 640;
  await show(null);

  await show({ path: "a.md", contentHeight: 300 });
  // The scrollbar is a sibling of the viewport, so only the scroll area as a whole sees it.
  await userEvent.click(
    container.querySelector<HTMLElement>('[data-slot="scroll-area-scrollbar"]')!,
  );
  const chosen = viewport().scrollTop;
  await show({ path: "a.md", contentHeight: 2000 });
  await nextFrame();
  expect(viewport().scrollTop).toBe(chosen);
});

it("restores once the viewport alone becomes tall enough to reach the saved position", async () => {
  const { show, viewport, nextFrame } = mountDocument();

  await show({ path: "a.md", contentHeight: 2000 });
  viewport().scrollTop = 640;
  await show(null);

  // The content never changes size: at 700px tall in a 200px viewport it can only scroll to 500.
  await show({ path: "a.md", contentHeight: 700, viewportHeight: 200 });
  expect(viewport().scrollTop).toBe(500);
  await show({ path: "a.md", contentHeight: 700, viewportHeight: 50 });
  await nextFrame();
  expect(viewport().scrollTop).toBe(640);
});

it("keeps the saved position when the surface unmounts while its panel is hidden", async () => {
  const { container, show, viewport } = mountDocument();

  await show({ path: "a.md", contentHeight: 2000 });
  viewport().scrollTop = 640;
  container.style.display = "none";
  await show(null);
  container.style.display = "";

  await show({ path: "a.md", contentHeight: 2000 });
  expect(viewport().scrollTop).toBe(640);
});
