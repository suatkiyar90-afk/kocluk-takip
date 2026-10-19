export {
  RECENT_YEAR_COUNT,
  applyOsymPlan,
  formatPlan,
  loadExistingTopics,
  normalizeTopicKey,
  planOsymSync,
  resolveSubjectId,
  runOsymSync,
  seedSubjectIds,
} from "./osym-sync";
export type {
  OsymExistingTopicRow,
  OsymInsertAction,
  OsymPlan,
  OsymSkipAction,
  OsymSubjectSeed,
  OsymTopicSeed,
  OsymUpdateAction,
} from "./osym-sync";
import type { OsymSubjectSeed } from "./osym-sync";
import { runOsymSync } from "./osym-sync";

const Y13 = [
  2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014,
];
const Y16 = [
  2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014,
  2013, 2012, 2011,
];
const Y15 = [
  2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014,
  2013, 2012,
];
const Y11 = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016];

export const TYT_OSYM_DATA: OsymSubjectSeed[] = [
  {
    subjectId: "turkce",
    subjectName: "Türkçe",
    years: Y13,
    topics: [
      {
        name: "Sözcükte Anlam",
        aliases: ["Sözcükte Anlamı"],
        counts: [3, 4, 5, 3, 4, 5, 1, 3, 3, 3, 3, 3, 3],
      },
      {
        name: "Cümlede Anlam",
        aliases: ["Cümlede Anlamı"],
        counts: [3, 3, 5, 4, 3, 3, 6, 3, 7, 7, 7, 6, 6],
      },
      {
        name: "Paragraf",
        aliases: ["Paragrafın Anlamı ve Yapısı", "Paragrafta Anlam"],
        counts: [27, 26, 26, 26, 26, 25, 26, 22, 22, 22, 22, 26, 23],
      },
      {
        name: "Ses Bilgisi",
        aliases: [],
        counts: [0, 0, 0, 1, 0, 1, 0, 1, 3, 3, 1, 1, 1],
      },
      {
        name: "Dil Bilgisi",
        aliases: ["Karma Dil Bilgisi", "Sözcükte Yapı"],
        counts: [3, 3, 0, 2, 3, 2, 3, 8, 1, 1, 3, 2, 5],
      },
      {
        name: "Yazım Kuralları",
        aliases: [],
        counts: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1],
      },
      {
        name: "Noktalama İşaretleri",
        aliases: [],
        counts: [2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "Anlatım Bozukluğu",
        aliases: ["Anlatım Bozuklukları"],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 0, 0],
      },
    ],
  },
  {
    subjectId: "matematik",
    subjectName: "Temel Matematik",
    years: Y16,
    topics: [
      {
        name: "Temel Kavramlar",
        aliases: [],
        counts: [0, 3, 1, 2, 3, 3, 1, 4, 4, 4, 3, 0, 4, 2, 0, 0],
      },
      {
        name: "Sayı Basamakları",
        aliases: [],
        counts: [1, 1, 2, 1, 1, 2, 1, 2, 1, 2, 2, 1, 0, 2, 2, 1],
      },
      {
        name: "Bölünebilme Kuralları",
        aliases: ["Bölme ve Bölünebilme"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 2, 0, 0, 1],
      },
      {
        name: "EBOB-EKOK",
        aliases: ["EBOB - EKOK"],
        counts: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2, 1, 2, 5, 0, 0],
      },
      {
        name: "Rasyonel Sayılar",
        aliases: [],
        counts: [1, 1, 2, 2, 2, 0, 3, 1, 0, 1, 1, 1, 2, 1, 2, 4],
      },
      {
        name: "Basit Eşitsizlikler",
        aliases: [],
        counts: [0, 1, 0, 3, 1, 1, 1, 0, 1, 1, 1, 2, 0, 1, 1, 0],
      },
      {
        name: "Mutlak Değer",
        aliases: [],
        counts: [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "Üslü Sayılar",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 0, 2, 2, 2, 2, 1, 3, 3],
      },
      {
        name: "Köklü Sayılar",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 1, 0, 0, 2, 1],
      },
      {
        name: "Çarpanlara Ayırma",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 2, 1, 0, 3],
      },
      {
        name: "Oran-Orantı",
        aliases: ["Oran Orantı"],
        counts: [2, 1, 0, 1, 1, 1, 1, 0, 0, 2, 0, 2, 2, 3, 3, 0],
      },
      {
        name: "Denklem Çözme",
        aliases: ["Birinci Dereceden Denklemler"],
        counts: [0, 1, 0, 1, 0, 2, 0, 1, 2, 1, 0, 2, 2, 3, 4, 0],
      },
      {
        name: "Problemler",
        aliases: ["Sayı Kesir Problemleri"],
        counts: [15, 12, 11, 10, 13, 11, 13, 12, 11, 11, 13, 10, 8, 10, 5, 10],
      },
      {
        name: "Kümeler",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 2, 1, 0, 1, 0],
      },
      {
        name: "Mantık",
        aliases: [],
        counts: [2, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0],
      },
      {
        name: "Fonksiyonlar",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 2, 1, 2],
      },
      {
        name: "Polinomlar",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Permütasyon-Kombinasyon",
        aliases: ["Permütasyon", "Kombinasyon"],
        counts: [1, 1, 3, 1, 0, 0, 2, 1, 1, 1, 0, 1, 1, 1, 0, 0],
      },
      {
        name: "Olasılık",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "Veri – İstatistik",
        aliases: ["Veri - İstatistik", "İstatistik"],
        counts: [1, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 2],
      },
    ],
  },
  {
    subjectId: "tyt-geometri",
    subjectName: "Geometri",
    years: Y13,
    topics: [
      {
        name: "Açılar ve Üçgenler",
        aliases: ["Doğruda ve Üçgende Açılar"],
        counts: [4, 4, 5, 5, 4, 4, 2, 2, 3, 2, 1, 1, 1],
      },
      {
        name: "Çokgenler",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 1, 1],
      },
      {
        name: "Yamuk",
        aliases: [],
        counts: [1, 1, 1, 1, 0, 0, 2, 0, 1, 1, 0, 0, 0],
      },
      {
        name: "Eşkenar Dörtgen",
        aliases: ["Eşkenar Dörtgen - Deltoid"],
        counts: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Deltoid",
        aliases: [],
        counts: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Kare",
        aliases: [],
        counts: [0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1],
      },
      {
        name: "Dikdörtgen",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 2, 1, 1, 0, 1, 0, 0],
      },
      {
        name: "Çember ve Daire",
        aliases: ["Çemberde Açı", "Dairede Alan"],
        counts: [0, 0, 0, 0, 0, 0, 0, 2, 1, 2, 1, 1, 2],
      },
      {
        name: "Analitik Geometri",
        aliases: ["Noktanın ve Doğrunun Analitiği"],
        counts: [0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 2, 2],
      },
      {
        name: "Katı Cisimler",
        aliases: [],
        counts: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
      },
    ],
  },
  {
    subjectId: "tyt-fizik",
    subjectName: "Fizik",
    years: Y15,
    topics: [
      {
        name: "Fizik Bilimine Giriş",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0],
      },
      {
        name: "Madde ve Özellikleri",
        aliases: ["Madde Ve Özellikleri"],
        counts: [1, 1, 1, 1, 1, 1, 0, 1, 0, 2, 1, 1, 1, 0, 1],
      },
      {
        name: "Kuvvet ve Hareket",
        aliases: ["Hareket ve Kuvvet"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1],
      },
      {
        name: "İş, Güç ve Enerji",
        aliases: ["İş, Güç ve  Enerji"],
        counts: [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 3, 1, 2, 1, 2],
      },
      {
        name: "Isı, Sıcaklık ve Genleşme",
        aliases: ["Isı ve Sıcaklık"],
        counts: [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 2, 2, 2, 2, 1],
      },
      {
        name: "Elektrostatik",
        aliases: [],
        counts: [1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0],
      },
      {
        name: "Elektrik ve Manyetizma",
        aliases: ["Elektrik Akımı ve Manyetizma"],
        counts: [0, 0, 1, 2, 0, 1, 1, 1, 0, 2, 2, 2, 2, 4, 4],
      },
      {
        name: "Basınç",
        aliases: [],
        counts: [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1],
      },
      {
        name: "Kaldırma Kuvveti",
        aliases: ["Basınç ve Kaldırma Kuvveti"],
        counts: [1, 1, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1],
      },
      {
        name: "Dalgalar",
        aliases: [],
        counts: [1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1],
      },
      {
        name: "Optik",
        aliases: [],
        counts: [1, 1, 1, 2, 1, 1, 1, 2, 2, 3, 1, 1, 1, 1, 2],
      },
    ],
  },
  {
    subjectId: "tyt-kimya",
    subjectName: "Kimya",
    years: Y13,
    topics: [
      {
        name: "Kimya Bilimi",
        aliases: [],
        counts: [0, 1, 1, 1, 1, 1, 1, 0, 2, 3, 3, 3, 4],
      },
      {
        name: "Atomun Yapısı",
        aliases: ["Atom ve Periyodik Sistem"],
        counts: [1, 1, 1, 0, 0, 0, 1, 1, 0, 2, 0, 0, 2],
      },
      {
        name: "Periyodik Tablo",
        aliases: ["Periyodik Sistem"],
        counts: [0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 2, 1, 0],
      },
      {
        name: "Maddenin Halleri",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1],
      },
      {
        name: "Kimyasal Türler Arası Etkileşimler",
        aliases: [],
        counts: [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 5, 1],
      },
      {
        name: "Kimyasal Hesaplamalar",
        aliases: ["Mol Kavramı ve Kimyasal Hesaplamalar"],
        counts: [1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 2],
      },
      {
        name: "Kimyanın Temel Kanunları",
        aliases: [],
        counts: [0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0],
      },
      {
        name: "Asit, Baz ve Tuz",
        aliases: ["Asitler, Bazlar ve Tuzlar"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
      },
      {
        name: "Karışımlar",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 2, 2, 2],
      },
      {
        name: "Kimya Her Yerde",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 1, 1],
      },
    ],
  },
  {
    subjectId: "tyt-biyoloji",
    subjectName: "Biyoloji",
    years: Y13,
    topics: [
      {
        name: "Canlıların Ortak Özellikleri",
        aliases: ["Yaşam Bilimi Biyoloji"],
        counts: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1],
      },
      {
        name: "Canlıların Temel Bileşenleri",
        aliases: [],
        counts: [1, 0, 1, 1, 0, 1, 1, 1, 1, 3, 3, 1, 2],
      },
      {
        name: "Hücre ve Organelleri",
        aliases: ["Hücre"],
        counts: [1, 0, 1, 1, 1, 1, 1, 0, 0, 2, 1, 2, 0],
      },
      {
        name: "Hücre Zarından Madde Geçişi",
        aliases: [],
        counts: [1, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 1],
      },
      {
        name: "Canlıların Sınıflandırılması",
        aliases: ["Canlılar Dünyası"],
        counts: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
      },
      {
        name: "Hücre Bölünmeleri ve Üreme",
        aliases: ["Hücre Bölünmeleri"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],
      },
      {
        name: "Kalıtım",
        aliases: ["Kalıtımın Genel İlkeleri"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 0, 2, 2, 1, 2],
      },
      {
        name: "Ekosistem Ekolojisi",
        aliases: ["Ekosistem Ekoloji"],
        counts: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 2, 2],
      },
      {
        name: "Güncel Çevre Sorunları",
        aliases: [],
        counts: [0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 2, 1],
      },
    ],
  },
  {
    subjectId: "tyt-tarih",
    subjectName: "Tarih",
    years: Y13,
    topics: [
      {
        name: "Tarih ve Zaman",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      },
      {
        name: "İlk ve Orta Çağlarda Türk Dünyası",
        aliases: ["Orta Çağ'da Dünya"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "İslam Medeniyetinin Doğuşu ve İlk İslam Devletleri",
        aliases: ["İslam Medeniyetinin Doğuşu"],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      },
      {
        name: "Türklerin İslamiyet'i Kabulü ve İlk Türk İslam Devletleri",
        aliases: ["Türklerin İslamiyet’i Kabulü ve İlk Türk İslam Devletleri"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "Beylikten Devlete Osmanlı",
        aliases: ["Beylikten Devlete Osmanlı Siyaseti"],
        counts: [1, 1, 0, 0, 1, 0, 0, 1, 1, 2, 1, 1, 1],
      },
      {
        name: "Dünya Gücü Osmanlı",
        aliases: [],
        counts: [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      },
      {
        name: "Değişim Çağında Avrupa ve Osmanlı",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
      },
      {
        name: "Uluslararası İlişkilerde Denge Stratejisi (1774-1914)",
        aliases: [],
        counts: [0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 1, 2, 2],
      },
      {
        name: "XX. Yüzyıl Başlarında Osmanlı Devleti ve Dünya",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 1, 0, 1, 2, 2, 2, 1],
      },
      {
        name: "Milli Mücadele",
        aliases: ["Kurtuluş Savaşı"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 2, 0, 2],
      },
      {
        name: "Atatürkçülük ve Türk İnkılabı",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 0, 1, 0, 4, 3, 5, 4],
      },
    ],
  },
  {
    subjectId: "tyt-cografya",
    subjectName: "Coğrafya",
    years: Y13,
    topics: [
      {
        name: "Doğa ve İnsan",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1],
      },
      {
        name: "Dünya’nın Şekli ve Hareketleri",
        aliases: ["Dünyanın Şekli ve Hareketleri"],
        counts: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
      },
      {
        name: "Coğrafi Konum",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
      },
      {
        name: "Harita Bilgisi",
        aliases: [],
        counts: [0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 0],
      },
      {
        name: "İklim Bilgisi",
        aliases: ["Atmosfer ve İklim"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 1, 4],
      },
      {
        name: "İç ve Dış Kuvvetler",
        aliases: [],
        counts: [0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 2, 3],
      },
      {
        name: "Nüfus ve Yerleşme",
        aliases: ["Nüfus"],
        counts: [1, 1, 1, 1, 0, 1, 1, 2, 1, 2, 3, 2, 0],
      },
      {
        name: "Türkiye’nin Yer Şekilleri",
        aliases: [],
        counts: [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      },
      {
        name: "Ekonomik Faaliyetler",
        aliases: [],
        counts: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
      },
      {
        name: "Bölgeler",
        aliases: ["Bölge Kavramı ve Bölgeler"],
        counts: [1, 1, 1, 1, 0, 1, 1, 0, 0, 1, 2, 1, 2],
      },
      {
        name: "Uluslararası Ulaşım Hatları",
        aliases: ["Ulaşım"],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
      },
      {
        name: "Doğal Afetler",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0],
      },
    ],
  },
  {
    subjectId: "tyt-felsefe",
    subjectName: "Felsefe",
    years: Y13,
    topics: [
      {
        name: "Felsefenin Konusu",
        aliases: ["Felsefe’nin Konusu", "Felsefe'nin Konusu"],
        counts: [1, 0, 1, 2, 1, 2, 0, 1, 0, 1, 0, 1, 1],
      },
      {
        name: "Bilgi Felsefesi",
        aliases: [],
        counts: [1, 3, 1, 2, 2, 0, 1, 1, 2, 2, 2, 1, 2],
      },
      {
        name: "Bilim Felsefesi",
        aliases: [],
        counts: [0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0],
      },
      {
        name: "Varlık Felsefesi",
        aliases: [],
        counts: [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 3, 1, 1],
      },
      {
        name: "Ahlak Felsefesi",
        aliases: [],
        counts: [0, 1, 1, 1, 1, 0, 2, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "Siyaset Felsefesi",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1],
      },
      {
        name: "Din Felsefesi",
        aliases: [],
        counts: [0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1],
      },
      {
        name: "Sanat Felsefesi",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1],
      },
      {
        name: "İlk Çağ Felsefesi",
        aliases: [],
        counts: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "20. Yüzyıl Felsefesi",
        aliases: [],
        counts: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ],
  },
  {
    subjectId: "tyt-din",
    subjectName: "Din Kültürü ve Ahlak Bilgisi",
    years: Y11,
    topics: [
      {
        name: "Bilgi ve İnanç",
        aliases: [],
        counts: [2, 1, 1, 1, 1, 1, 1, 2, 1, 0, 2],
      },
      {
        name: "Din ve İslam",
        aliases: [],
        counts: [0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "İslam ve İbadet",
        aliases: [],
        counts: [0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1],
      },
      {
        name: "Gençlik ve Değerler",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0],
      },
      {
        name: "Allah İnsan İlişkisi",
        aliases: ["Allah-İnsan İlişkisi"],
        counts: [1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Hz. Muhammed (S.A.V.)",
        aliases: ["Hz. Muhammed (S.A.V)", "Hz. Muhammed ve Örnekliği"],
        counts: [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1],
      },
      {
        name: "Vahiy ve Akıl",
        aliases: ["Kur'an'a Göre Hz. Muhammed"],
        counts: [0, 0, 0, 0, 0, 1, 2, 0, 1, 1, 0],
      },
      {
        name: "İslam Düşüncesinde İtikadi, Siyasi ve Fıkhi Yorumlar",
        aliases: ["İslam Düşüncesinde Yorumlar"],
        counts: [1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0],
      },
      {
        name: "Din, Kültür ve Medeniyet",
        aliases: [],
        counts: [0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 1],
      },
    ],
  },
];

async function main(): Promise<void> {
  await runOsymSync({
    examType: "TYT",
    data: TYT_OSYM_DATA,
    hint: "npm run seed:osym-tyt",
  });
}

if (process.argv[1]?.includes("seed-osym-tyt") ?? false) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("OSYM TYT aktarim hatasi:", err);
      process.exit(1);
    });
}
