import "~/index.css";

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, onTestFinished, vi } from "vite-plus/test";

import { ScrollArea } from "~/components/ui/scroll-area";
import { useRememberedScroll } from "./useRememberedScroll";

function Document(props: { readonly path: string; readonly contentHeight?: number }) {
  const ref = useRememberedScroll(props.path);
  return (
    <div style={{ height: 200 }}>
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
