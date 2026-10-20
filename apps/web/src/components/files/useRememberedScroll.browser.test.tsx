import "~/index.css";

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, onTestFinished, vi } from "vite-plus/test";

import { ScrollArea } from "~/components/ui/scroll-area";
import { useRememberedScroll } from "./useRememberedScroll";

function Document(props: { readonly path: string }) {
  const ref = useRememberedScroll(props.path);
  return (
    <div style={{ height: 200 }}>
      <ScrollArea>
        <div ref={ref} style={{ height: 2000 }} />
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
