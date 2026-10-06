import type { LegalDocumentModel } from "./types";

export const KVKK_TEACHER: LegalDocumentModel = {
  key: "kvkk_teacher",
  version: "2026-10-05",
  title: "Öğretmen Aydınlatma Metni (6698 sayılı KVKK m.10)",
  summary: {
    intro:
      "Demirci Anadolu İmam Hatip Lisesi Akademik Takip Sistemi'ni kullanırken kişisel verilerin işlenir. Devam etmeden önce bilmen gerekenler:",
    bullets: [
      "Hangi veriler: adın, kullanıcı adın, giriş ve son görülme zamanların, hangi öğrenci için hangi türde işlem yaptığın (dönüt, hedef, soru cevabı, deneme yükleme, duyuru) ve ürettiğin içerikler. Dönüt veya mesaj metinleri işlem kaydına yazılmaz.",
      "Ne için: koçluk sürecinin yürütülmesi, öğrenci takibi, sistem güvenliği ve işleyişin yönetimi.",
      "Kimler görür: okul yöneticileri; ürettiğin içerikleri ise ilgili öğrenciler. Veriler teknik hizmet sağlayıcılarda saklanır, sunucular yurt dışında olabilir.",
      "Hakların var: KVKK m.11 kapsamında haklarını kullanabilirsin.",
    ],
  },
  sections: [
    {
      heading: "Öğretmen Aydınlatma Metni (6698 sayılı KVKK m.10)",
      blocks: [
        {
          type: "p",
          text: "Bu metin, Demirci Anadolu İmam Hatip Lisesi Akademik Takip Sistemi'ni kullanırken kişisel verilerinizin nasıl işlendiğini anlatır.",
        },
      ],
    },
    {
      heading: "1. Veri sorumlusu",
      blocks: [
        { type: "p", text: "Demirci Anadolu İmam Hatip Lisesi" },
      ],
    },
    {
      heading: "2. İşlenen kişisel veriler",
      blocks: [
        {
          type: "ul",
          items: [
            "Kimlik ve hesap bilgileri: ad soyad, kullanıcı adı, şifrenin geri döndürülemez özeti.",
            "Kullanım kayıtları: son giriş ve son görülme zamanı, hangi öğrenci için hangi türde işlem yaptığınız (dönüt yazma, hedef belirleme, soru cevaplama, deneme sonucu yükleme, duyuru gönderme) ve işlem zamanı. Bu kayıtlar işlem türünü ve zamanını içerir; yazdığınız dönüt veya mesajın metni bu kayıtlara yazılmaz.",
            "Ürettiğiniz içerikler: öğrencilere yazdığınız dönütler, hedefler, soru cevapları (yazılı, sesli ve görsel).",
            "Bildirim abonelik bilgisi (tarayıcı/cihaz bildirim adresi) ve güvenlik amacıyla giriş denemelerinin zamanı ve IP adresi.",
          ],
        },
      ],
    },
    {
      heading: "3. İşleme amaçları",
      blocks: [
        {
          type: "p",
          text: "Koçluk sürecinin yürütülmesi, öğrenci takibi ve iletişimi, sistem güvenliğinin sağlanması, sistemin kullanım ve işleyişinin yönetilmesi ile işlemlerin izlenebilirliğinin sağlanması.",
        },
      ],
    },
    {
      heading: "4. Hukuki sebep ve toplama yöntemi",
      blocks: [
        {
          type: "p",
          text: "Verileriniz, sistemi kullanmanız sırasında elektronik ortamda otomatik olarak ve sizin girdiğiniz bilgilerle toplanır. İşleme; iş ve görev ilişkisinin gereklerinin yerine getirilmesi ve veri sorumlusunun meşru menfaati (KVKK m.5/2-f) ile hukuki yükümlülükler sebeplerine dayanır.",
        },
      ],
    },
    {
      heading: "5. Verilerin aktarıldığı taraflar",
      blocks: [
        {
          type: "p",
          text: "Verileriniz, okul yöneticileri ve ilgili öğrenciler (ürettiğiniz içerikler için) tarafından görülebilir. Teknik hizmet sağlayıcılara (uygulama barındırma, veritabanı, dosya depolama ve tarayıcı bildirim servisleri) aktarılabilir; bu sağlayıcıların sunucuları yurt dışında bulunabilir.",
        },
      ],
    },
    {
      heading: "6. Saklama süresi",
      blocks: [
        {
          type: "p",
          text: "Verileriniz, görevinizin devamı süresince ve ardından 30 gün boyunca saklanır; süre sonunda silinir veya anonim hale getirilir. Kullanım ve işlem kayıtları 90 gün sonra silinir. Güvenlik amaçlı giriş denemesi kayıtları kısa süre sonra silinir.",
        },
      ],
    },
    {
      heading: "7. Sorumluluklarınız",
      blocks: [
        {
          type: "p",
          text: "Öğrenci verilerini yalnızca koçluk amacıyla kullanın, sistem dışında paylaşmayın, şifrenizi kimseyle paylaşmayın ve ortak cihazlarda oturumu kapatın.",
        },
      ],
    },
    {
      heading: "8. Haklarınız",
      blocks: [
        {
          type: "p",
          text: "KVKK m.11 uyarınca; verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, işlenme amacını öğrenme, aktarıldığı tarafları bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, bu işlemlerin aktarıldığı taraflara bildirilmesini isteme, otomatik analiz sonucu aleyhinize bir sonuç çıkmasına itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.",
        },
      ],
    },
  ],
};
