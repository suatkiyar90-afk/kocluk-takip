import { db } from "./index";
import { curriculumTopics } from "./schema";

interface TopicSeed {
  examType: "TYT" | "AYT";
  subjectId: string;
  subjectName: string;
  topicName: string;
  sortOrder: number;
}

const TURKCE = "TYT";
const AYT = "AYT";

const TOPICS: TopicSeed[] = [
  ...list(TURKCE, "turkce", "Türkçe", [
    "Sözcükte Anlam",
    "Söz Öbeklerinde Anlam",
    "Cümlede Anlam",
    "Paragrafın Anlamı ve Yapısı",
    "Ses Bilgisi",
    "Yazım Kuralları",
    "Noktalama İşaretleri",
    "Sözcükte Yapı",
    "Sözcük Türleri",
    "Cümlenin Öğeleri",
    "Cümle Çeşitleri",
    "Anlatım Bozuklukları",
  ]),
  ...list(TURKCE, "sosyal", "Sosyal Bilimler", [
    "Tarih ve Zaman",
    "İnsanlığın İlk Çağları",
    "Orta Çağ'da Dünya",
    "İlk ve Orta Çağlarda Türk Dünyası",
    "İslam Medeniyetinin Doğuşu",
    "Doğa ve İnsan",
    "Dünya'nın Şekli ve Hareketleri",
    "Coğrafi Koşullar ve Yaşam",
    "İklim Bilgisi",
    "Nüfus ve Yerleşme",
    "İslamiyet Öncesi Türk Devletleri",
  ]),
  ...list(TURKCE, "matematik", "Temel Matematik", [
    "Temel Kavramlar",
    "Sayı Basamakları",
    "Bölme - Bölünebilme",
    "EBOB - EKOK",
    "Rasyonel Sayılar",
    "Basit Eşitsizlikler",
    "Mutlak Değer",
    "Üslü Sayılar",
    "Köklü Sayılar",
    "Çarpanlara Ayırma",
    "Oran - Orantı",
    "Denklem Kurma ve Problemler",
    "Kümeler",
    "Fonksiyonlar",
    "Permütasyon - Kombinasyon",
    "Olasılık",
  ]),
  ...list(TURKCE, "fen", "Fen Bilimleri", [
    "Fizik Bilimine Giriş",
    "Madde ve Özellikleri",
    "Basınç",
    "Isı, Sıcaklık ve Genleşme",
    "Hareket ve Kuvvet",
    "İş, Güç ve Enerji",
    "Kimya Bilimine Giriş",
    "Atom ve Periyodik Sistem",
    "Kimyasal Türler Arası Etkileşimler",
    "Kimyasal Reaksiyonlar",
    "Asitler, Bazlar ve Tuzlar",
    "Yaşam Bilimi Biyoloji",
    "Hücre",
    "Canlıların Dünyası",
  ]),
  ...list(AYT, "edebiyat", "Türk Dili ve Edebiyatı", [
    "İslamiyet Öncesi Türk Edebiyatı",
    "Geçiş Dönemi Türk Edebiyatı",
    "Halk Edebiyatı",
    "Divan Edebiyatı",
    "Tanzimat Dönemi Edebiyatı",
    "Servet-i Fünun Edebiyatı",
    "Fecr-i Ati Edebiyatı",
    "Milli Edebiyat",
    "Cumhuriyet Dönemi Şiiri",
    "Cumhuriyet Dönemi Roman ve Öykü",
    "Edebî Akımlar ve Sanatçılar",
    "Ses Bilgisi, Yazım ve Noktalama",
    "Sözcük Türleri ve Cümle Bilgisi",
    "Anlatım Bozuklukları",
  ]),
  ...list(AYT, "tarih1", "Tarih (S1)", [
    "Tarih Bilimine Giriş",
    "İlk Türk Devletleri",
    "İslam Tarihi",
    "Türk - İslam Tarihi",
    "Türkiye Tarihi",
    "Osmanlı Devleti'nin Kuruluşu",
    "Osmanlı Devleti'nin Yükselme Dönemi",
    "Osmanlı Devleti'nin Duraklama ve Gerileme Dönemi",
  ]),
  ...list(AYT, "cografya1", "Coğrafya (S1)", [
    "Doğa ve İnsan Etkileşimi",
    "Dünya'nın Şekli ve Hareketleri",
    "Harita Bilgisi",
    "İklim Bilgisi",
    "Yerin Şekillenmesi",
    "Bitki Örtüsü",
    "Nüfus ve Yerleşme",
    "Göçler ve Kentleşme",
  ]),
  ...list(AYT, "matematik-ayt", "Matematik", [
    "Fonksiyonlar",
    "Polinomlar",
    "Parabol",
    "Trigonometri",
    "Toplam - Çarpım Sembolleri",
    "Diziler",
    "Limit ve Süreklilik",
    "Türev",
    "Türevin Uygulamaları",
    "Belirsiz İntegral",
    "Belirli İntegral",
    "İntegralin Uygulamaları",
    "Logaritma",
    "Karmaşık Sayılar",
    "Permütasyon - Kombinasyon - Olasılık",
  ]),
  ...list(AYT, "fizik", "Fizik", [
    "Vektörler",
    "Bağıl Hareket",
    "Newton'un Hareket Yasaları",
    "Bir Boyutta Sabit İvmeli Hareket",
    "Atışlar",
    "İş, Enerji ve Güç",
    "İtme ve Momentum",
    "Kütle Merkezi",
    "Basit Makineler",
    "Denge ve Tork",
    "Düzgün Dairesel Hareket",
    "Basit Harmonik Hareket",
    "Dalga Mekaniği",
    "Elektrik ve Manyetizma",
    "İndüksiyon ve Alternatif Akım",
  ]),
  ...list(AYT, "kimya", "Kimya", [
    "Kimya Bilimi",
    "Atomun Yapısı",
    "Periyodik Sistem",
    "Kimyasal Bağlar",
    "Maddenin Halleri",
    "Gazlar",
    "Çözeltiler",
    "Kimyasal Tepkimeler ve Enerji",
    "Tepkime Hızı",
    "Kimyasal Denge",
    "Asitler ve Bazlar",
    "Elektrokimya",
    "Organik Kimya",
  ]),
  ...list(AYT, "biyoloji", "Biyoloji", [
    "Hücre ve Yapısı",
    "Protein Sentezi",
    "Enzimler",
    "Hücresel Solunum",
    "Fotosentez",
    "Ekoloji ve Çevre",
    "Kalıtım (Genetik)",
    "Evrimin Canlılığa Etkileri",
    "Sinir Sistemi",
    "Endokrin Sistem",
    "Duyu Organları",
    "İskelet ve Kas Sistemi",
    "Dolaşım Sistemi",
    "Sindirim Sistemi",
  ]),
  ...list(AYT, "tarih2", "Tarih (S2)", [
    "20. Yüzyıl Başlarında Osmanlı Devleti",
    "Birinci Dünya Savaşı",
    "Mondros Ateşkes Antlaşması",
    "Kurtuluş Savaşı'nın Hazırlık Dönemi",
    "Birinci TBMM Dönemi",
    "Kurtuluş Savaşı Cepheleri",
    "Cumhuriyetin İlanı",
    "Atatürk İlkeleri",
    "Atatürk Dönemi İnkılapları",
    "Atatürk Dönemi Türk Dış Politikası",
  ]),
  ...list(AYT, "cografya2", "Coğrafya (S2)", [
    "Ekosistem ve Enerji Akışı",
    "Türkiye'nin Coğrafi Konumu",
    "Türkiye'nin Yer Şekilleri",
    "Türkiye'de İklim",
    "Türkiye'de Toprak ve Bitki Örtüsü",
    "Türkiye'de Tarım",
    "Türkiye'de Enerji ve Madenler",
    "Türkiye'de Sanayi",
    "Türkiye'de Ulaşım",
    "Türkiye'de Ticaret",
    "Doğal Afetler",
  ]),
  ...list(AYT, "felsefe", "Felsefe", [
    "Felsefeyi Tanıma",
    "Bilgi Felsefesi",
    "Bilim Felsefesi",
    "Varlık Felsefesi",
    "Ahlak Felsefesi",
    "Siyaset Felsefesi",
    "Sanat Felsefesi",
    "Din Felsefesi",
    "İlk Çağ Felsefesi",
    "Orta Çağ Felsefesi",
    "Yeni Çağ Felsefesi",
    "19. ve 20. Yüzyıl Felsefesi",
  ]),
  ...list(AYT, "din", "Din Kültürü ve Ahlak Bilgisi", [
    "Bilgi ve İnanç",
    "İslam ve İbadet",
    "Kur'an-ı Kerim ve Özellikleri",
    "Hz. Muhammed (s.a.v.)",
    "Vahiy ve Akıl",
    "İslam Düşüncesinde Yorumlar",
    "Tasavvufi Yorumlar",
    "Din ve Laiklik",
    "Anadolu'da İslam",
    "Günümüz Dünya Sorunları ve Etik",
  ]),
];

function list(
  examType: "TYT" | "AYT",
  subjectId: string,
  subjectName: string,
  topics: string[],
): TopicSeed[] {
  return topics.map((topicName, index) => ({
    examType,
    subjectId,
    subjectName,
    topicName,
    sortOrder: index + 1,
  }));
}

async function main() {
  const values = TOPICS.map((t) => t);
  await db
    .insert(curriculumTopics)
    .values(values)
    .onConflictDoNothing({
      target: [
        curriculumTopics.examType,
        curriculumTopics.subjectId,
        curriculumTopics.topicName,
      ],
    });

  const rows = await db.select().from(curriculumTopics);
  console.log(`Müfredat çekirdeği: ${rows.length} konu hazır.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Müfredat seed hatası:", err);
    process.exit(1);
  });