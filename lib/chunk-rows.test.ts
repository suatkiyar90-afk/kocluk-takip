import { describe, expect, it } from "vitest";
import { DEFAULT_INSERT_CHUNK_SIZE, chunkRows } from "./chunk-rows";

const POSTGRES_MAX_PARAMS = 65_535;
const TOPIC_COLUMNS = 17;
const EXAM_COLUMNS = 5;

describe("chunkRows", () => {
  it("boş dizide boş sonuç döner", () => {
    expect(chunkRows([])).toEqual([]);
  });

  it("200 satırlık varsayılan paketlere böler", () => {
    const rows = Array.from({ length: 4_294 }, (_, i) => i);
    const chunks = chunkRows(rows);

    expect(DEFAULT_INSERT_CHUNK_SIZE).toBe(200);
    expect(chunks).toHaveLength(Math.ceil(4_294 / 200));
    expect(chunks[0]).toHaveLength(200);
    expect(chunks[chunks.length - 1]).toHaveLength(4_294 % 200);
    expect(chunks.flat()).toEqual(rows);
  });

  it("her paket PostgreSQL parametre sınırının altında kalır", () => {
    const rows = Array.from({ length: 10_328 }, (_, i) => i);
    for (const chunk of chunkRows(rows)) {
      expect(chunk.length * TOPIC_COLUMNS).toBeLessThan(POSTGRES_MAX_PARAMS);
      expect(chunk.length * EXAM_COLUMNS).toBeLessThan(POSTGRES_MAX_PARAMS);
    }
  });

  it("geçersiz paket boyutunda satır kaybetmez", () => {
    const rows = [1, 2, 3];
    expect(chunkRows(rows, 0)).toEqual([[1], [2], [3]]);
    expect(chunkRows(rows, Number.NaN)).toEqual([[1], [2], [3]]);
    expect(chunkRows(rows, 1.9)).toEqual([[1], [2], [3]]);
  });
});
