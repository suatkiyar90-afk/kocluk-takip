import type { LegalDocumentModel } from "./types";

export const KVKK_STUDENT: LegalDocumentModel = {
  key: "kvkk_student",
  version: "2026-10-05",
  title: "KİŞİSEL VERİLERİN İŞLENMESİNE İLİŞKİN AYDINLATMA METNİ",
  summary: {
    intro:
      "Demirci Anadolu İmam Hatip Lisesi Akademik Takip Sistemi'ni kullanırken kişisel verilerin işlenir. Devam etmeden önce bilmen gerekenler:",
    bullets: [
      "Hangi veriler: adın, öğrenci numaran, günlük soru girişlerin, notların, hedeflerin, deneme sonuçların, yüklediğin soru fotoğrafları ve uygulama kullanım kayıtların.",
      "Ne için: koçluk sürecini yürütmek, öğretmeninin ilerlemeni takip edip dönüt vermesi, hedef ve program takibi, bildirim gönderme ve hesap güvenliği.",
      "Kimler görür: yalnızca sana atanmış öğretmenler ve okul yöneticileri. Veriler, uygulamayı çalıştıran teknik hizmet sağlayıcılarda (barındırma, veritabanı, dosya depolama) saklanır; bu sağlayıcıların sunucuları yurt dışında olabilir.",
      "Hakların: KVKK m.11 kapsamında bilgi isteme, düzeltme ve silme gibi haklarını kullanabilirsin.",
    ],
    minorNote:
      "",
  },
  sections: [
    {
      heading: "KİŞİSEL VERİLERİN İŞLENMESİNE İLİŞKİN AYDINLATMA METNİ",
      blocks: [
        {
          type: "p",
          text: "Veri Sorumlusu: Demirci Anadolu İmam Hatip Lisesi Müdürlüğü",
        },
        {
          type: "p",
          text: '6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, okulumuz tarafından geliştirilen "Akademik Takip Sistemi" uygulaması kapsamında kişisel verileriniz aşağıda açıklanan şartlarda işlenecektir.',
        },
        {
          type: "ul",
          items: [
            "1. İşlenen Kişisel Verileriniz: Ad, soyad, öğrenci numarası, sınıf/şube bilgisi, deneme sınavı sonuçları, çözülen soru sayıları, sisteme yüklenen soru/çözüm fotoğrafları ve IP adresi/tarayıcı bilgileri (sistem güvenliği için).",
            "2. İşlenme Amacı: Eğitim-öğretim faaliyetlerinin yürütülmesi, YKS hazırlık sürecinde öğrenci akademik gelişiminin takip edilmesi, koç öğretmenler tarafından öğrenciye özel çalışma programı ve geri bildirim hazırlanması amaçlarıyla işlenmektedir.",
            "3. Verilerin Aktarımı: Sistem üzerindeki verileriniz, yalnızca size atanan koç öğretmeniniz ve okul idaresi tarafından görüntülenebilir. Yasal zorunluluklar dışında hiçbir üçüncü şahıs veya kurumla paylaşılmaz. Uygulama altyapısı güvenli bulut sunucularında barındırılmaktadır.",
            "4. Veri İşleme Şartı ve Süresi: Verileriniz, velinizin açık rızasına ve eğitim faaliyetlerinin ifası yasal şartlarına dayanarak işlenmektedir. Öğrencinin okulumuzdan mezun olması veya ayrılması durumunda istatistiksel veriler anonimleştirilerek saklanacak, kişisel kimlikleyici veriler silinecektir.",
            "5. Haklarınız: KVKK'nın 11. maddesi uyarınca okulumuz idaresine başvurarak verilerinizin silinmesini, güncellenmesini veya işlenip işlenmediğini öğrenme hakkına sahipsiniz.",
          ],
        },
      ],
    },
  ],
};
