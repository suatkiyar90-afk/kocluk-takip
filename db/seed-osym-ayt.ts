import type { OsymSubjectSeed } from "./osym-sync";
import { runOsymSync } from "./osym-sync";

const Y_AYT_14 = [
  2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2013,
  2012,
];
const Y_AYT_12 = [
  2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015,
];
const Y_AYT_9 = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

export const AYT_OSYM_DATA: OsymSubjectSeed[] = [
  {
    subjectIds: ["matematik-ayt"],
    subjectName: "Matematik",
    years: Y_AYT_14,
    topics: [
      {
        name: "Temel Kavramlar",
        aliases: [],
        counts: [2, 1, 2, 4, 2, 3, 2, 2, 1, 3, 3, 6, 3, 0],
      },
      {
        name: "Sayı Basamakları",
        aliases: [],
        counts: [0, 1, 1, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 1],
      },
      {
        name: "Bölme ve Bölünebilme",
        aliases: ["Bölünebilme Kuralları"],
        counts: [1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1],
      },
      {
        name: "EBOB - EKOK",
        aliases: ["EBOB – EKOK", "EBOB-EKOK"],
        counts: [0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1],
      },
      {
        name: "Rasyonel Sayılar",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0],
      },
      {
        name: "Basit Eşitsizlikler",
        aliases: [],
        counts: [0, 1, 1, 1, 0, 1, 1, 1, 0, 2, 1, 1, 1, 0],
      },
      {
        name: "Mutlak Değer",
        aliases: [],
        counts: [1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0],
      },
      {
        name: "Üslü Sayılar",
        aliases: [],
        counts: [0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 2, 1, 2, 0],
      },
      {
        name: "Köklü Sayılar",
        aliases: [],
        counts: [1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2],
      },
      {
        name: "Çarpanlara Ayırma",
        aliases: [],
        counts: [0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 2, 2],
      },
      {
        name: "Oran-Orantı",
        aliases: ["Oran Orantı"],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
      },
      {
        name: "Kümeler",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 2, 1, 0, 2, 2, 2, 1, 1],
      },
      {
        name: "Mantık",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 0, 1, 4, 1, 1, 0, 1, 3],
      },
      {
        name: "Fonksiyonlar",
        aliases: ["Fonksiyonlarda Uygulamalar"],
        counts: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 3, 2],
      },
      {
        name: "Polinomlar",
        aliases: [],
        counts: [1, 1, 0, 2, 1, 1, 2, 2, 1, 3, 1, 2, 2, 2],
      },
      {
        name: "2. Dereceden Denklemler ve Eşitsizlikler",
        aliases: [
          "2.Dereceden Denklemler ve Eşitsizlikler",
          "İkinci Dereceden Denklemler",
          "Eşitsizlikler",
        ],
        counts: [1, 1, 1, 2, 2, 1, 1, 0, 1, 1, 0, 1, 1, 0],
      },
      {
        name: "Parabol",
        aliases: [],
        counts: [1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1],
      },
      {
        name: "Permütasyon-Kombinasyon-Olasılık - Binom",
        aliases: [
          "Permütasyon-Kombinasyon-Olasılık – Binom",
          "Sayma ve Olasılık",
          "Olasılık",
        ],
        counts: [3, 3, 3, 3, 3, 2, 3, 2, 2, 2, 3, 2, 2, 2],
      },
      {
        name: "Trigonometri",
        aliases: [],
        counts: [5, 5, 5, 5, 4, 5, 4, 3, 3, 2, 4, 2, 3, 4],
      },
      {
        name: "Karmaşık Sayılar",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 2, 1, 1, 2, 3, 3, 3, 3],
      },
      {
        name: "Logaritma",
        aliases: [],
        counts: [2, 2, 1, 3, 2, 1, 3, 3, 2, 3, 1, 2, 3, 2],
      },
      {
        name: "Diziler",
        aliases: [],
        counts: [1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 2, 2, 2, 2],
      },
      {
        name: "Limit",
        aliases: ["Limit ve Süreklilik"],
        counts: [2, 2, 2, 0, 2, 2, 0, 2, 2, 2, 2, 1, 1, 4],
      },
      {
        name: "Türev",
        aliases: [],
        counts: [3, 3, 3, 0, 4, 3, 0, 4, 4, 5, 5, 7, 6, 6],
      },
      {
        name: "İntegral",
        aliases: [],
        counts: [3, 3, 5, 0, 4, 4, 0, 4, 4, 5, 6, 7, 7, 4],
      },
    ],
  },
  {
    subjectIds: ["ayt-geometri"],
    subjectName: "Geometri",
    years: Y_AYT_12,
    topics: [
      {
        name: "Doğruda ve Üçgende Açılar",
        aliases: ["Doğruda ve Üçgende Açı"],
        counts: [0, 0, 1, 3, 1, 0, 1, 0, 1, 2, 2, 1],
      },
      {
        name: "Özel Üçgenler",
        aliases: ["Dik Üçgen ve Trigonometri", "İkizkenar ve Eşkenar Üçgen"],
        counts: [0, 0, 0, 0, 0, 0, 2, 0, 2, 2, 6, 0],
      },
      {
        name: "Üçgende Açıortay ve Kenarortay",
        aliases: ["Açıortay – Kenarortay", "Açıortay - Kenarortay"],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Üçgende Alan ve Benzerlik",
        aliases: [
          "Üçgende Alan Benzerlik",
          "Üçgende Alan",
          "Üçgende Benzerlik",
        ],
        counts: [1, 1, 0, 1, 0, 0, 0, 0, 0, 3, 1, 2],
      },
      {
        name: "Açı Kenar Bağıntıları",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
      },
      {
        name: "Çokgenler",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 1, 3],
      },
      {
        name: "Özel Dörtgenler",
        aliases: ["Dörtgenler", "Yamuk", "Paralelkenar", "Dikdörtgen", "Kare"],
        counts: [0, 0, 0, 1, 0, 0, 0, 0, 1, 4, 6, 5],
      },
      {
        name: "Çember ve Daire",
        aliases: ["Çemberde Açı", "Çemberde Uzunluk", "Dairede Alan"],
        counts: [2, 2, 2, 2, 2, 3, 2, 2, 1, 3, 3, 5],
      },
      {
        name: "Noktanın Analitiği",
        aliases: ["Noktanın ve Doğrunun Analitiği"],
        counts: [1, 1, 1, 1, 1, 2, 1, 0, 0, 0, 1, 2],
      },
      {
        name: "Doğrunun Analitiği",
        aliases: [],
        counts: [2, 2, 3, 0, 1, 2, 1, 1, 2, 2, 4, 1],
      },
      {
        name: "Dönüşüm Geometrisi",
        aliases: [],
        counts: [1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0],
      },
      {
        name: "Katı Cisimler",
        aliases: [],
        counts: [1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
      },
      {
        name: "Çemberin Analitiği",
        aliases: [],
        counts: [1, 1, 1, 0, 1, 1, 0, 0, 1, 1, 2, 1],
      },
    ],
  },
  {
    subjectIds: ["fizik"],
    subjectName: "Fizik",
    years: Y_AYT_9,
    topics: [
      {
        name: "Vektörler",
        aliases: [],
        counts: [0, 0, 0, 1, 1, 0, 0, 0, 0],
      },
      {
        name: "Hareket",
        aliases: ["Bağıl Hareket", "Bir Boyutta Sabit İvmeli Hareket"],
        counts: [0, 1, 1, 1, 0, 0, 1, 1, 0],
      },
      {
        name: "Newton’un Hareket Yasaları",
        aliases: ["Newton'un Hareket Yasaları"],
        counts: [1, 0, 1, 1, 1, 0, 1, 0, 1],
      },
      {
        name: "Atışlar",
        aliases: ["İki Boyutta Hareket"],
        counts: [1, 1, 1, 0, 0, 1, 1, 1, 1],
      },
      {
        name: "İş, Güç ve Enerji",
        aliases: [],
        counts: [1, 1, 1, 1, 0, 1, 1, 0, 0],
      },
      {
        name: "İtme ve Momentum",
        aliases: ["İtme ve Çizgisel Momentum"],
        counts: [0, 1, 1, 1, 1, 0, 1, 1, 1],
      },
      {
        name: "Kuvvet, Tork ve Denge",
        aliases: ["Tork ve Denge"],
        counts: [1, 0, 0, 0, 0, 1, 1, 1, 1],
      },
      {
        name: "Kütle Merkezi",
        aliases: ["Kütle ve Ağırlık Merkezi"],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Basit Makineler",
        aliases: [],
        counts: [0, 0, 0, 0, 1, 0, 0, 0, 0],
      },
      {
        name: "Elektrik Alan ve Potansiyel",
        aliases: ["Elektriksel Kuvvet, Alan ve Potansiyel"],
        counts: [0, 1, 1, 1, 0, 2, 1, 1, 1],
      },
      {
        name: "Paralel Levhalar ve Sığa",
        aliases: ["Düzgün Elektrik Alan ve Sığa"],
        counts: [1, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Manyetik Alan ve Manyetik Kuvvet",
        aliases: ["Manyetizma ve Elektromanyetik İndükleme"],
        counts: [1, 1, 1, 1, 1, 1, 0, 0, 0],
      },
      {
        name: "İndüksiyon, Alternatif Akım ve Transformatörler",
        aliases: ["Alternatif Akım ve Transformatörler"],
        counts: [1, 1, 2, 2, 1, 1, 2, 2, 2],
      },
      {
        name: "Düzgün Çembersel Hareket",
        aliases: ["Çembersel Hareket"],
        counts: [1, 1, 0, 1, 1, 1, 2, 1, 1],
      },
      {
        name: "Dönme, Yuvarlanma ve Açısal Momentum",
        aliases: ["Açısal Momentum"],
        counts: [1, 0, 0, 1, 1, 0, 1, 1, 0],
      },
      {
        name: "Kütle Çekim ve Kepler Yasaları",
        aliases: [],
        counts: [0, 1, 0, 1, 0, 1, 0, 0, 1],
      },
      {
        name: "Basit Harmonik Hareket",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "Dalga Mekaniği",
        aliases: [],
        counts: [1, 2, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "Atom Fiziğine Giriş ve Radyoaktivite",
        aliases: [],
        counts: [1, 1, 1, 0, 1, 1, 0, 1, 1],
      },
      {
        name: "Modern Fizik",
        aliases: [],
        counts: [1, 0, 1, 0, 2, 1, 0, 1, 1],
      },
      {
        name: "Modern Fiziğin Teknolojideki Uygulamaları",
        aliases: [],
        counts: [1, 1, 1, 0, 1, 1, 0, 1, 1],
      },
    ],
  },
  {
    subjectIds: ["kimya"],
    subjectName: "Kimya",
    years: Y_AYT_14,
    topics: [
      {
        name: "Kimya Bilimi",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 2, 0, 0, 1],
      },
      {
        name: "Atom ve Yapısı",
        aliases: ["Atomun Yapısı"],
        counts: [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 2, 2, 2, 4],
      },
      {
        name: "Periyodik Sistem",
        aliases: ["Periyodik Tablo"],
        counts: [0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 2, 2, 6, 2],
      },
      {
        name: "Kimyasal Türler Arası Etkileşim",
        aliases: ["Kimyasal Türler Arası Etkileşimler"],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 2, 0, 0],
      },
      {
        name: "Kimyasal Hesaplamalar",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 1, 2, 2],
      },
      {
        name: "Modern Atom Teorisi",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Gazlar",
        aliases: [],
        counts: [2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1],
      },
      {
        name: "Sıvı Çözeltiler",
        aliases: ["Sıvı Çözeltiler ve Çözünürlük"],
        counts: [1, 1, 2, 2, 2, 2, 2, 1, 1, 3, 1, 1, 1, 1],
      },
      {
        name: "Kimyasal Tepkimelerde Enerji",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 3, 2, 2],
      },
      {
        name: "Kimyasal Tepkimelerde Hız",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
      },
      {
        name: "Kimyasal Tepkimelerde Denge",
        aliases: [],
        counts: [1, 2, 1, 2, 1, 1, 1, 0, 0, 1, 2, 1, 1, 2],
      },
      {
        name: "Asit-Baz Dengesi",
        aliases: ["Sulu Çözelti Dengeleri (Asit-Baz)"],
        counts: [1, 0, 1, 0, 0, 1, 1, 2, 1, 1, 0, 1, 1, 2],
      },
      {
        name: "Çözünürlük Dengesi",
        aliases: ["Sulu Çözelti Dengeleri (Çözünürlük)"],
        counts: [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1],
      },
      {
        name: "Kimya ve Elektrik",
        aliases: ["Elektrokimya"],
        counts: [1, 2, 2, 3, 2, 2, 3, 2, 2, 3, 2, 2, 2, 1],
      },
      {
        name: "Organik Kimya",
        aliases: ["Karbon Kimyasına Giriş", "Organik Bileşikler"],
        counts: [4, 4, 3, 1, 3, 3, 1, 3, 4, 6, 11, 12, 10, 10],
      },
    ],
  },
  {
    subjectIds: ["biyoloji"],
    subjectName: "Biyoloji",
    years: Y_AYT_9,
    topics: [
      {
        name: "Sinir Sistemi",
        aliases: [],
        counts: [0, 0, 1, 1, 0, 0, 0, 0, 1],
      },
      {
        name: "Endokrin Sistem",
        aliases: [],
        counts: [1, 0, 1, 2, 0, 1, 1, 1, 0],
      },
      {
        name: "Duyu Organları",
        aliases: [],
        counts: [0, 1, 0, 0, 1, 0, 1, 0, 0],
      },
      {
        name: "Destek ve Hareket Sistemi",
        aliases: [],
        counts: [1, 0, 0, 0, 1, 1, 0, 0, 1],
      },
      {
        name: "Sindirim Sistemi",
        aliases: [],
        counts: [0, 1, 1, 1, 0, 0, 1, 1, 0],
      },
      {
        name: "Dolaşım Sistemi",
        aliases: ["Dolaşım ve Bağışıklık Sistemi"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "Solunum Sistemi",
        aliases: [],
        counts: [0, 0, 1, 1, 1, 1, 1, 1, 0],
      },
      {
        name: "Üriner Sistem",
        aliases: ["Boşaltım Sistemi"],
        counts: [1, 1, 0, 1, 0, 0, 1, 1, 1],
      },
      {
        name: "Üreme Sistemi ve Embriyonik Gelişim",
        aliases: [],
        counts: [1, 1, 0, 0, 1, 0, 0, 0, 0],
      },
      {
        name: "Komünite ve Popülasyon Ekolojisi",
        aliases: [],
        counts: [2, 1, 2, 2, 2, 2, 2, 0, 2],
      },
      {
        name: "Genden Proteine",
        aliases: ["Nükleik Asitler ve Protein Sentezi"],
        counts: [2, 2, 2, 1, 2, 2, 3, 2, 3],
      },
      {
        name: "Canlılık ve Enerji",
        aliases: ["Canlılarda Enerji Dönüşümleri"],
        counts: [0, 0, 1, 1, 1, 0, 0, 0, 0],
      },
      {
        name: "Fotosentez ve Kemosentez",
        aliases: [],
        counts: [1, 1, 1, 0, 1, 1, 1, 1, 1],
      },
      {
        name: "Hücresel Solunum",
        aliases: [],
        counts: [1, 1, 0, 1, 0, 1, 1, 1, 0],
      },
      {
        name: "Bitki Biyolojisi",
        aliases: [],
        counts: [2, 2, 2, 0, 2, 2, 0, 3, 2],
      },
      {
        name: "Canlılar ve Çevre",
        aliases: [],
        counts: [0, 1, 0, 1, 0, 1, 0, 1, 1],
      },
    ],
  },
  {
    subjectIds: ["edebiyat"],
    subjectName: "Türk Dili ve Edebiyatı",
    years: Y_AYT_9,
    topics: [
      {
        name: "Anlam Bilgisi",
        aliases: ["Sözcükte, Cümlede ve Paragrafta Anlam"],
        counts: [6, 6, 6, 6, 6, 3, 6, 3, 4],
      },
      {
        name: "Dil Bilgisi",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Metin Türleri",
        aliases: ["Edebi Bilgiler ve Metin Türleri"],
        counts: [0, 1, 1, 1, 0, 0, 0, 2, 0],
      },
      {
        name: "Şiir Bilgisi",
        aliases: [],
        counts: [2, 3, 2, 3, 2, 2, 3, 3, 2],
      },
      {
        name: "Edebi Sanatlar",
        aliases: ["Söz Sanatları"],
        counts: [1, 1, 2, 1, 2, 2, 1, 1, 1],
      },
      {
        name: "İslamiyet Öncesi Türk Edebiyatı ve Geçiş Dönemi",
        aliases: ["İslamiyet Öncesi Türk Edebiyatı"],
        counts: [2, 1, 1, 0, 1, 1, 1, 0, 0],
      },
      {
        name: "Halk Edebiyatı",
        aliases: [],
        counts: [1, 0, 1, 2, 1, 2, 2, 1, 1],
      },
      {
        name: "Divan Edebiyatı",
        aliases: [],
        counts: [5, 3, 4, 5, 5, 6, 4, 3, 5],
      },
      {
        name: "Tanzimat Edebiyatı",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 2, 1, 2, 2],
      },
      {
        name: "Servet-i Fünun ve Fecr-i Ati Edebiyatı",
        aliases: [
          "Servet-i Fünun Ve Fecr-i Ati Edebiyatı",
          "Servet-i Fünun Edebiyatı",
        ],
        counts: [1, 1, 1, 1, 1, 1, 2, 1, 1],
      },
      {
        name: "Milli Edebiyat",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 3],
      },
      {
        name: "Cumhuriyet Dönemi Edebiyatı",
        aliases: ["Cumhuriyet Dönemi Türk Edebiyatı"],
        counts: [3, 2, 3, 2, 3, 3, 2, 5, 4],
      },
      {
        name: "Batı Edebiyat Akımları",
        aliases: ["Edebi Akımlar"],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
    ],
  },
  {
    subjectIds: ["cografya1", "cografya2"],
    subjectName: "Coğrafya",
    years: Y_AYT_12,
    topics: [
      {
        name: "İklim ve Yer Şekilleri",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 2, 1, 1, 5, 2, 5],
      },
      {
        name: "Coğrafi Konum",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1],
      },
      {
        name: "Dünya’nın Şekli ve Hareketleri",
        aliases: ["Dünyanın Şekli ve Hareketleri"],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
      },
      {
        name: "Harita Bilgisi",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
      },
      {
        name: "İç ve Dış Kuvvetler",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      },
      {
        name: "Ekosistem",
        aliases: ["Biyoçeşitlilik ve Ekosistem"],
        counts: [2, 3, 2, 6, 4, 3, 3, 3, 0, 3, 3, 2],
      },
      {
        name: "Nüfus Politikaları",
        aliases: ["Nüfus ve Yerleşme"],
        counts: [1, 0, 1, 1, 0, 0, 2, 1, 1, 4, 1, 3],
      },
      {
        name: "Yerleşmelerin Özellikleri",
        aliases: [],
        counts: [1, 2, 2, 1, 1, 0, 0, 1, 4, 3, 1, 2],
      },
      {
        name: "Uluslararası Ulaşım Hatları",
        aliases: ["Ulaşım"],
        counts: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Ekonomik Faaliyetler ve Doğal Kaynaklar",
        aliases: ["Ekonomik Faaliyetler"],
        counts: [1, 1, 1, 0, 2, 1, 1, 1, 1, 0, 1, 4],
      },
      {
        name: "Geçmişten Geleceğe Şehir ve Ekonomi",
        aliases: ["Şehirlerin Fonksiyonları"],
        counts: [2, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 0],
      },
      {
        name: "Türkiye’de Ekonomi",
        aliases: ["Türkiye Ekonomisi"],
        counts: [2, 3, 0, 5, 2, 3, 1, 2, 4, 5, 5, 10],
      },
      {
        name: "Türkiye’nin İşlevsel Bölgeleri ve Kalkınma Projeleri",
        aliases: ["Bölgesel Kalkınma Projeleri"],
        counts: [1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0],
      },
      {
        name: "Küresel Ticaret",
        aliases: [],
        counts: [1, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1],
      },
      {
        name: "Kültür Bölgeleri",
        aliases: ["İlk Kültür Merkezleri ve Kültür Bölgeleri"],
        counts: [2, 1, 1, 1, 0, 1, 0, 2, 0, 0, 1, 1],
      },
      {
        name: "Uluslararası Örgütler",
        aliases: ["Küresel ve Bölgesel Örgütler"],
        counts: [0, 1, 1, 1, 0, 1, 1, 2, 0, 0, 0, 0],
      },
      {
        name: "Ülkeler Arası Etkileşimler",
        aliases: ["Jeopolitik Konum"],
        counts: [0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0],
      },
      {
        name: "Bölgeler ve Ülkeler",
        aliases: ["Ülkeler Coğrafyası"],
        counts: [0, 0, 1, 0, 4, 2, 2, 1, 1, 8, 7, 3],
      },
      {
        name: "Çevre ve Toplum",
        aliases: ["Doğal Afetler ve Çevre"],
        counts: [3, 2, 4, 1, 1, 3, 3, 1, 0, 6, 13, 6],
      },
    ],
  },
  {
    subjectIds: ["tarih1", "tarih2"],
    subjectName: "Tarih",
    years: Y_AYT_9,
    topics: [
      {
        name: "Tarih ve Zaman",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "İnsanlığın İlk Dönemleri",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        name: "İlk ve Orta Çağlarda Türk Dünyası",
        aliases: ["Orta Çağ'da Dünya"],
        counts: [2, 2, 2, 2, 2, 1, 2, 2, 3],
      },
      {
        name: "İslam Medeniyetinin Doğuşu",
        aliases: ["İslam Medeniyetinin Doğuşu ve İlk İslam Devletleri"],
        counts: [1, 1, 1, 1, 1, 1, 2, 1, 1],
      },
      {
        name: "Türklerin İslamiyet’i Kabulü ve İlk Türk İslam Devletleri",
        aliases: [],
        counts: [1, 1, 2, 1, 1, 3, 1, 1, 1],
      },
      {
        name: "Yerleşme ve Devletleşme Sürecinde Selçuklu Türkiyesi",
        aliases: [],
        counts: [1, 1, 0, 0, 1, 0, 0, 1, 0],
      },
      {
        name: "Beylikten Devlete Osmanlı",
        aliases: ["Beylikten Devlete Osmanlı Siyaseti"],
        counts: [1, 2, 2, 2, 3, 0, 1, 1, 2],
      },
      {
        name: "Devletleşme Sürecinde Savaşçılar ve Askerler",
        aliases: ["Beylikten Devlete Osmanlı Medeniyeti"],
        counts: [1, 0, 0, 0, 1, 0, 1, 0, 0],
      },
      {
        name: "Dünya Gücü Osmanlı",
        aliases: [],
        counts: [0, 0, 0, 2, 0, 1, 0, 1, 2],
      },
      {
        name: "Sultan ve Osmanlı Merkez Teşkilatı",
        aliases: ["Klasik Çağda Osmanlı Toplum Düzeni"],
        counts: [0, 0, 0, 1, 1, 1, 0, 0, 0],
      },
      {
        name: "Değişen Dünya Dengeleri Karşısında Osmanlı Siyaseti",
        aliases: [],
        counts: [1, 0, 0, 0, 1, 1, 1, 0, 0],
      },
      {
        name: "Değişim Çağında Avrupa ve Osmanlı",
        aliases: [],
        counts: [1, 0, 0, 1, 0, 1, 2, 2, 0],
      },
      {
        name: "Uluslararası İlişkilerde Denge Stratejisi (1774-1914)",
        aliases: [],
        counts: [1, 3, 2, 1, 0, 1, 0, 0, 1],
      },
      {
        name: "Devrimler Çağında Değişen Devlet-Toplum İlişkileri",
        aliases: [],
        counts: [0, 1, 1, 0, 0, 1, 0, 0, 0],
      },
      {
        name: "Sermaye ve Emek",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 1, 1, 0],
      },
      {
        name: "XX. Yüzyıl Başlarında Osmanlı Devleti ve Dünya",
        aliases: [],
        counts: [2, 1, 3, 1, 0, 1, 2, 4, 3],
      },
      {
        name: "Milli Mücadele",
        aliases: ["Kurtuluş Savaşı"],
        counts: [4, 4, 3, 5, 5, 4, 4, 3, 1],
      },
      {
        name: "Atatürkçülük ve Türk İnkılabı",
        aliases: [],
        counts: [1, 1, 2, 1, 1, 3, 2, 2, 2],
      },
      {
        name: "İki Savaş Arasındaki Dönemde Türkiye ve Dünya",
        aliases: [],
        counts: [1, 2, 0, 1, 0, 0, 0, 0, 1],
      },
      {
        name: "II. Dünya Savaşı Sürecinde ve Sonrasında Türkiye ve Dünya",
        aliases: [
          "II. Dünya Savaşı Sürecinde – Sonrasında Türkiye ve Dünya",
        ],
        counts: [1, 0, 1, 0, 2, 0, 0, 0, 1],
      },
      {
        name: "XXI. Yüzyılın Eşiğinde Türkiye ve Dünya",
        aliases: [],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 1],
      },
    ],
  },
  {
    subjectIds: ["felsefe"],
    subjectName: "Felsefe Grubu",
    years: Y_AYT_9,
    topics: [
      {
        name: "Felsefe ve Bilim",
        aliases: ["Felsefenin Konusu", "Bilim Felsefesi"],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 1],
      },
      {
        name: "Bilgi Felsefesi",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 0, 2, 1],
      },
      {
        name: "Varlık Felsefesi",
        aliases: [],
        counts: [1, 2, 0, 0, 0, 0, 2, 1, 1],
      },
      {
        name: "Ahlak Felsefesi",
        aliases: [],
        counts: [0, 0, 0, 1, 1, 1, 0, 0, 0],
      },
      {
        name: "Sanat Felsefesi",
        aliases: [],
        counts: [0, 1, 1, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Din Felsefesi",
        aliases: [],
        counts: [0, 0, 1, 0, 0, 0, 1, 0, 0],
      },
      {
        name: "20. Yüzyıl Felsefesi",
        aliases: ["İlk Çağ ve Modern Felsefe"],
        counts: [1, 0, 0, 1, 1, 1, 0, 0, 0],
      },
      {
        name: "Mantığa Giriş",
        aliases: [],
        counts: [1, 1, 1, 1, 1, 1, 2, 1, 1],
      },
      {
        name: "Klasik Mantık",
        aliases: [],
        counts: [2, 0, 2, 1, 1, 1, 1, 2, 2],
      },
      {
        name: "Mantık ve Dil",
        aliases: ["Sembolik Mantık"],
        counts: [0, 1, 0, 1, 1, 1, 0, 0, 0],
      },
      {
        name: "Psikoloji Bilimini Tanıyalım",
        aliases: ["Psikolojinin Konusu"],
        counts: [1, 0, 1, 0, 0, 0, 3, 1, 0],
      },
      {
        name: "Psikolojinin Temel Süreçleri",
        aliases: ["Davranışın Oluşumu"],
        counts: [2, 2, 0, 1, 1, 1, 0, 1, 0],
      },
      {
        name: "Öğrenme, Bellek, Düşünme",
        aliases: ["Öğrenme Bellek Düşünme"],
        counts: [0, 1, 1, 1, 1, 1, 0, 1, 2],
      },
      {
        name: "Ruh Sağlığının Temelleri",
        aliases: ["Ruh Sağlığı"],
        counts: [0, 0, 1, 1, 1, 1, 0, 0, 0],
      },
      {
        name: "Sosyolojiye Giriş",
        aliases: ["Birey ve Toplum (Sosyolojiye Giriş)"],
        counts: [0, 1, 1, 1, 1, 1, 0, 1, 0],
      },
      {
        name: "Birey ve Toplum",
        aliases: [],
        counts: [1, 1, 0, 0, 0, 0, 2, 1, 1],
      },
      {
        name: "Toplumsal Yapı",
        aliases: [],
        counts: [1, 0, 1, 0, 0, 0, 1, 0, 1],
      },
      {
        name: "Toplumsal Değişme ve Gelişme",
        aliases: [],
        counts: [0, 1, 0, 1, 1, 1, 0, 0, 1],
      },
      {
        name: "Toplum ve Kültür",
        aliases: [],
        counts: [1, 0, 1, 0, 0, 1, 0, 1, 0],
      },
      {
        name: "Toplumsal Kurumlar",
        aliases: [],
        counts: [0, 0, 0, 1, 1, 0, 0, 0, 1],
      },
    ],
  },
  {
    subjectIds: ["din"],
    subjectName: "Din Kültürü ve Ahlak Bilgisi",
    years: Y_AYT_9,
    topics: [
      {
        name: "İslam’da İbadet",
        aliases: ["İslam ve İbadet"],
        counts: [0, 0, 1, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Allah-İnsan İlişkisi",
        aliases: ["Allah, İnsan İlişkisi", "Allah İnsan İlişkisi"],
        counts: [1, 1, 0, 0, 0, 1, 0, 0, 0],
      },
      {
        name: "Dünya ve Ahiret",
        aliases: ["Ahiret İnancı"],
        counts: [1, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: "Kur’an’a Göre Hz. Muhammed",
        aliases: ["Hz. Muhammed ve Örnekliği"],
        counts: [0, 1, 2, 1, 0, 0, 1, 1, 2],
      },
      {
        name: "Kur’an’da Bazı Kavramlar",
        aliases: [],
        counts: [1, 1, 0, 1, 1, 2, 2, 1, 3],
      },
      {
        name: "İnançla İlgili Meseleler",
        aliases: [],
        counts: [0, 0, 1, 0, 1, 1, 1, 0, 0],
      },
      {
        name: "Yahudilik ve Hristiyanlık",
        aliases: [],
        counts: [0, 0, 0, 0, 1, 0, 0, 0, 0],
      },
      {
        name: "İslam ve Bilim",
        aliases: ["İslam ve Bilim, Estetik"],
        counts: [1, 1, 1, 1, 3, 1, 2, 1, 0],
      },
      {
        name: "Anadolu’da İslam",
        aliases: [],
        counts: [0, 0, 0, 2, 0, 1, 0, 0, 0],
      },
      {
        name: "İslam Düşüncesinde Tasavvufi Yorumlar ve Mezhepler",
        aliases: ["İslam Düşüncesinde Yorumlar"],
        counts: [0, 2, 1, 0, 0, 1, 0, 2, 0],
      },
      {
        name: "Güncel Dini Meseleler",
        aliases: [],
        counts: [1, 0, 0, 1, 0, 0, 0, 0, 0],
      },
      {
        name: "Hint ve Çin Dinleri",
        aliases: ["Yaşayan Dünya Dinleri"],
        counts: [1, 0, 0, 0, 0, 0, 0, 1, 1],
      },
    ],
  },
];

async function main(): Promise<void> {
  await runOsymSync({
    examType: "AYT",
    data: AYT_OSYM_DATA,
    hint: "npm run seed:osym-ayt",
  });
}

if (process.argv[1]?.includes("seed-osym-ayt") ?? false) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("OSYM AYT aktarim hatasi:", err);
      process.exit(1);
    });
}
