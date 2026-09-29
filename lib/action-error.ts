export function actionErrorMessage(err: unknown): string {
  console.error("Server action error:", err);
  return "Bir hata oluştu, lütfen tekrar deneyin.";
}
