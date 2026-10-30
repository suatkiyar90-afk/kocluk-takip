export function actionErrorMessage(err: unknown): string {
  console.error("Server action error:", err);
  return "Bir hata oluştu, lütfen tekrar deneyin.";
}

/**
 * Teknik hata mesajını kullanıcıya gösterir. Sadece yönetici tarafındaki
 * içe aktarma/analiz ekranları gibi, hata ayrıntısının sorunu çözmek için
 * gerekli olduğu yerlerde kullanılmalıdır.
 */
export function actionErrorDetail(err: unknown): string {
  console.error("Server action error:", err);
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message && cause.message !== err.message) {
      return `${err.message} (${cause.message})`;
    }
    return err.message || err.name || "Bilinmeyen hata";
  }
  if (typeof err === "string" && err.trim() !== "") return err;
  return String(err);
}
