import { describe, expect, it } from "vitest";
import { onlyActiveTopics } from "./topic-activity";

describe("onlyActiveTopics", () => {
  it("yalnızca aktif konuları bırakır", () => {
    const rows = [
      { id: 1, isActive: true },
      { id: 2, isActive: false },
      { id: 3, isActive: true },
      { id: 4, isActive: false },
    ];
    expect(onlyActiveTopics(rows).map((r) => r.id)).toEqual([1, 3]);
  });

  it("pasif olmayan (tümü aktif) listeyi aynen döndürür", () => {
    const rows = [
      { id: 1, isActive: true },
      { id: 2, isActive: true },
    ];
    expect(onlyActiveTopics(rows)).toHaveLength(2);
  });

  it("boş liste ve tamamen pasif liste için boş döner", () => {
    expect(onlyActiveTopics([])).toEqual([]);
    expect(
      onlyActiveTopics([
        { id: 1, isActive: false },
        { id: 2, isActive: false },
      ]),
    ).toEqual([]);
  });

  it("girdi listesini değiştirmez (kopya döndürür)", () => {
    const rows = [
      { id: 1, isActive: false },
      { id: 2, isActive: true },
    ];
    const result = onlyActiveTopics(rows);
    expect(result).not.toBe(rows);
    expect(rows).toHaveLength(2);
  });
});
