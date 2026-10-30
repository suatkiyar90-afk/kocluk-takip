/**
 * PostgreSQL tek sorguda en fazla 65.535 bağlama parametresi kabul eder.
 * `student_period_topic_analyses` satırı 17, `student_period_exams` satırı
 * 5 parametre üretir. 200'lük paketler en kötü durumda 3.400 parametre
 * kullandığı için sınırın güvenli biçimde altında kalır.
 */
export const DEFAULT_INSERT_CHUNK_SIZE = 200;

export function chunkRows<T>(
  rows: readonly T[],
  size: number = DEFAULT_INSERT_CHUNK_SIZE,
): T[][] {
  const normalizedSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : 1;
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += normalizedSize) {
    chunks.push(rows.slice(i, i + normalizedSize));
  }
  return chunks;
}
