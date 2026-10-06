import { describe, expect, it } from "vitest";
import {
  buildEnteredTodaySet,
  hasEnteredData,
  studentsWithoutEnteredData,
} from "@/lib/data-entry-activity";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("buildEnteredTodaySet", () => {
  it("sadece konu girişi olan öğrenciyi işaretler", () => {
    const entered = buildEnteredTodaySet([A], []);
    expect(hasEnteredData(entered, A)).toBe(true);
    expect(hasEnteredData(entered, B)).toBe(false);
  });

  it("sadece deneme girişi olan öğrenciyi işaretler", () => {
    const entered = buildEnteredTodaySet([], [B]);
    expect(hasEnteredData(entered, B)).toBe(true);
    expect(hasEnteredData(entered, A)).toBe(false);
  });

  it("her ikisi de olan öğrenciyi bir kez işaretler", () => {
    const entered = buildEnteredTodaySet([A], [A, B]);
    expect(entered.size).toBe(2);
    expect(hasEnteredData(entered, A)).toBe(true);
    expect(hasEnteredData(entered, B)).toBe(true);
  });

  it("hiç girişi olmayan boş set döner", () => {
    const entered = buildEnteredTodaySet([], []);
    expect(entered.size).toBe(0);
    expect(hasEnteredData(entered, C)).toBe(false);
  });

  it("aynı öğrencinin iki kaydı seti şişirmez", () => {
    const entered = buildEnteredTodaySet([A, A], [A]);
    expect(entered.size).toBe(1);
  });
});

describe("studentsWithoutEnteredData", () => {
  it("girmeyenleri sırayla döner", () => {
    const students = [{ id: A }, { id: B }, { id: C }];
    const entered = buildEnteredTodaySet([B], [A]);
    expect(studentsWithoutEnteredData(students, entered).map((s) => s.id)).toEqual(
      [C],
    );
  });

  it("herkes girdiğinde boş liste döner", () => {
    const students = [{ id: A }];
    const entered = buildEnteredTodaySet([A], []);
    expect(studentsWithoutEnteredData(students, entered)).toEqual([]);
  });
});
