# Pis Yedili kuralları

Bu belge, motorun uyguladığı kuralları anlatır. Kaynak: [Vikipedi, Pis Yedili](https://tr.wikipedia.org/wiki/Pis_Yedili) ve proje sahibinin kararları. Pis Yedili'nin masadan masaya değişen yerleri vardır; motor aşağıdaki seçimleri yapar. Değişiklik yapılacaksa önce proje sahibine sorulur.

## Oyun

- 52 kartlık tek deste, jokersiz. 2, 3 ya da 4 oyuncu.
- Dağıtıcıdan sonraki oyuncu başlar. Herkese 7'şer kart dağıtılır, destenin üstündeki kart yere açılır.
- Amaç, elindeki bütün kartları ilk bitirmektir. Eli ilk bitiren eli kazanır.

## İlk kart

- İlk atılan kart **sinek** olmalıdır. Elinde sinek yoksa, sinek çıkana kadar desteden kart çekersin; sinek gelince onu atarsın.
- Bu ilk kartın **özel etkisi yoktur** (sinek 7, 8, 10, As ya da Vale olsa bile).
- Destenin üstünden yere açılan kartın etkisi yoktur. İlk oyuncu sinek atınca geçerli renk sinek olur.

## Oynama

- Sırası gelen oyuncu, yerdeki üst kartla **aynı renkten** (geçerli renk) ya da **aynı sayıdan** bir kart atar.
- Atacak kartı yoksa desteden **1 kart çeker** ve sıra geçer. Çektiği kart o sırada oynanmaz.
- Deste biterse yerdeki kartlar (üstteki hariç) karıştırılıp yeni deste olur.

## Özel kartlar

| Kart | Etkisi |
| --- | --- |
| **7** | Sıradaki oyuncu 3 kart çeker. Sıradaki de bir 7 atarsa ceza birikir: iki 7 = 6 kart, üç 7 = 9 kart. Bekleyen 7 varken yalnız 7 oynanabilir; yoksa oyuncu cezayı çeker ve sırası geçer. |
| **8** | Sıradaki oyuncu atlanır (iki kişilik oyunda atan yeniden oynar). |
| **10** | Oyun yönü tersine döner (iki kişilikte sıra yine karşıdaki oyuncuya geçer). |
| **As** | Atan oyuncu hariç herkes 1 kart çeker. |
| **Vale** | Her zaman atılabilir (bekleyen 7 cezası yokken). Atan oyuncu yeni rengi seçer. |

Eli bitiren kart özel kart olsa bile el biter; As'ın çektirdiği kartlar kazanamayan oyuncuların ceza puanına girer.

## TEK

Elinde **2 kart** varken, birini atmadan önce "TEK" denmelidir. Denmeden son kartı bırakan oyuncu 2 kart çeker. TEK, sıra kimdeyse onun için, herhangi bir anda söylenebilir; yalnız elde tam 2 kart varken geçerlidir.

## Tek el ve Puanlı oyun

Varsayılan olarak **tek el** oynanır: eli ilk bitiren oyunu kazanır.

**Puanlı** oyunda el biter bitmez diğer oyuncuların elinde kalan kartlar ceza puanı olur:

| Kart | Puan |
| --- | --- |
| As | 11 |
| Vale | 25 |
| Papaz, Kız | 10 |
| 2'den 10'a | üzerindeki sayı kadar |

- Ceza puanları el el toplanır. **Hedef puana** (varsayılan 101; uygulamada 51, 101 ya da 151) ulaşan oyuncu oyundan elenir.
- Elenen oyuncu sonraki ellere katılmaz. Tek oyuncu kalınca oyun biter ve o kazanır. Hepsi aynı elde elenirse en az puanlı kazanır.
- İnsan oyuncu elenince oyun hemen bitirilebilir (`endNow`); en az puanlı kazanır.
- Puan çarpanı ve eşli oyun yoktur.

## Motor seçimleri (kuraldan çıkmayan ayrıntılar)

- Çekilen kart aynı sırada oynanmaz.
- Bekleyen 7 cezasına Vale ile karşılık verilemez.
- Sıra yönü: koltuk numarası artan yöndedir; 10 atılınca tersine döner.
