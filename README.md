# pisyedili-engine

Pis Yedili kart oyunu için kural motoru ve bilgisayar oyuncusu. Ücretsizdir ve MIT lisansıyla dağıtılır. Başka hiçbir pakete ihtiyaç duymaz. Düz JavaScript ile yazıldığı için tarayıcıda da Node.js'te de derlemeden çalışır.

Motor şunları yapar:

- 52 kartlık tek desteyi (jokersiz) karıştırır, 2, 3 ya da 4 oyuncuya 7'şer kart dağıtır ve üstteki kartı yere açar.
- Atılan her kartı kurala göre denetler: aynı renk ya da aynı sayı, ilk kartın sinek olması, birikmiş 7 cezası.
- Özel kartları uygular: 7 (3 kart çektirir, üst üste birikir), 8 (atlatır), 10 (yönü değiştirir), As (herkese 1 kart çektirir), Vale (renk seçtirir).
- "TEK" kuralını işletir: 2 kartı olan oyuncu birini atmadan önce TEK demezse 2 kart çeker.
- Deste biterse yerdeki kartları (üstteki hariç) karıştırıp desteyi yeniler.
- Eli ilk bitireni belirler; isteğe bağlı Puanlı oyunda elde kalan kartları ceza puanı olarak yazar, hedef puana ulaşanı oyun dışı bırakır.
- Kaydedilip sonra kaldığı yerden sürdürülebilir.
- Üç seviyede bilgisayar oyuncusu içerir: kolay, normal ve zor.

Kuralların ayrıntısı: [docs/KURALLAR.md](docs/KURALLAR.md).

## Hızlı başlangıç

Üç bilgisayarın birlikte bir el oynaması:

```js
import { PisYediliHand, botAction } from './src/index.js';

const el = new PisYediliHand({ players: 3 });        // herkese 7 kart dağıtır
while (el.phase === 'play') {
  const koltuk = el.turn;
  const a = botAction(el.view(koltuk), { level: 'zor', seat: koltuk });
  if (a.action === 'draw') el.draw(koltuk);          // oynayacak kart yok: çek
  else {
    if (a.tek) el.tek(koltuk);                       // 2 kart kalmışsa TEK de
    el.play(koltuk, a.card, a.color);                // Vale ise a.color rengi gelir
  }
}
console.log(el.winner, el.penalties);                // eli bitiren ve kalan kart puanları
```

Oyuncular 0, 1, 2 ve 3 numaralı koltuklarda oturur. İlk oynayan, dağıtıcıdan sonraki koltuktur: `(dealer + 1) % oyuncu sayısı`.

## Kartların yazılışı

Her kart, önce rengin harfi sonra kartın değeri yazılarak gösterilir. Örneğin `S14` maça ası, `H11` kupa valesi, `C7` sinek yedilisidir.

| Renk | Harf |
| --- | --- |
| Maça | `S` |
| Kupa | `H` |
| Karo | `D` |
| Sinek | `C` |

2'den 10'a kadar olan kartlar kendi sayısıyla yazılır. Vale `11`, kız `12`, papaz `13`, as `14` ile gösterilir.

## Bir elin oynanışı

Hangi aşamada olunduğu `el.phase` ile öğrenilir: `play` (oynanıyor) ya da `done` (el bitti). Sıranın hangi koltukta olduğu `el.turn` ile öğrenilir.

| Yapılacak iş | Komut |
| --- | --- |
| Atılabilecek kartları öğrenmek | `el.legalCards(koltuk)` |
| Kart atmak | `el.play(koltuk, 'H9')`; Vale ise rengi de verilir: `el.play(koltuk, 'S11', 'D')` |
| Kart çekmek (atacak kart yok, 7 cezası ya da ilk sinek yok) | `el.draw(koltuk)` |
| TEK demek (elinde tam 2 kart varken) | `el.tek(koltuk)` |

Kurala aykırı bir hamle motor tarafından reddedilir ve oyunun durumu değişmez. Sonuç her zaman `{ ok: true, ... }` ya da `{ ok: false, error: '...' }` olarak döner. Olası hata kodları: `done` (el bitmiş), `notYourTurn`, `noCard`, `illegal` (bu kart şimdi atılamaz), `needColor` (Vale için renk verilmedi), `hasPlay` (oynayacak kartın var, çekemezsin), `notTwo` (TEK için elde 2 kart yok).

Yerde ve masada olanlar:

| Bilgi | Nerede bulunur |
| --- | --- |
| Yerdeki üst kart | `el.top` |
| Geçerli renk (Vale bunu değiştirebilir) | `el.color` |
| Oyun yönü (`1` ya da 10'dan sonra `-1`) | `el.dir` |
| Bekleyen 7 cezası (kaç tane 7 birikti) | `el.pending` (ceza `pending × 3` karttır) |
| İlk kart henüz atılmadı mı | `el.opening` |
| Kimler TEK dedi | `el.tekCalled` |

El bittiğinde: `el.winner` (eli bitiren koltuk) ve `el.penalties` (her koltukta kalan kartların ceza puanı) hazırdır.

## Bütün oyun

`PisYediliMatch`, oyunu el el sürdürür. Tek elli oyunda (varsayılan) ilk biten kazanır. Puanlı oyunda ceza puanları toplanır, `targetScore` (varsayılan 101) değerine ulaşan oyundan elenir, en sona kalan kazanır.

```js
import { PisYediliMatch, botAction } from './src/index.js';

const oyun = new PisYediliMatch({ settings: { players: 3, scored: true, targetScore: 51 } });
while (!oyun.over) {
  const el = oyun.startRound();
  while (el.phase === 'play') {
    const k = el.turn;
    const a = botAction(el.view(k), { level: 'normal', seat: k });
    if (a.action === 'draw') el.draw(k);
    else { if (a.tek) el.tek(k); el.play(k, a.card, a.color); }
  }
  oyun.finishRound();   // ceza puanlarını ekler, elenenleri ve oyunun bitip bitmediğini işler
}
console.log(oyun.winner, oyun.scores);
```

`oyun.standings` sıralamayı verir: `[{ seat, score, out, place }]`. `oyun.out` her koltuğun elenip elenmediğini, `oyun.rounds` biten ellerin özetini tutar. Eleneni beklemeden oyunu bitirmek (örneğin insan oyuncu elendiyse) için `oyun.endNow()` kullanılır; en az puanlı kazanır.

## Kaydetme ve yükleme

Oyun istenen her an kaydedilip daha sonra kaldığı yerden sürdürülebilir:

```js
const kayit = JSON.stringify(oyun);                          // PisYediliMatch ya da PisYediliHand
const oyun2 = PisYediliMatch.fromJSON(JSON.parse(kayit));    // tek bir el için PisYediliHand.fromJSON
```

Kayıt, rastgele sayı üretecini içermez; geri yüklerken ikinci parametre olarak verilebilir: `PisYediliMatch.fromJSON(kayit, rng)`.

## Oyuncunun görebildikleri

`el.view(koltuk)` yalnızca o koltuktaki oyuncunun görmesi gereken bilgileri verir: kendi kartları, diğer oyuncuların elinde kaç kart kaldığı, yerdeki üst kart, geçerli renk, yön, bekleyen ceza, atabileceği kartlar (`legal`) ve son hamle. Başkalarının kartları, el bitene kadar hiçbir yerde yer almaz. Çevrim içi oyunda sunucu her oyuncuya yalnız kendi `view`'ını göndermelidir. `oyun.view(koltuk)` aynısını bütün oyun için yapar.

## Bilgisayar oyuncusu

```js
const a = botAction(el.view(koltuk), { level: 'normal', seat: koltuk });
// { action: 'draw' }  ya da  { action: 'play', card: 'H9', color: undefined, tek: false }
```

Bilgisayar yalnız `view`'daki bilgiyi kullanır, yani rakiplerin kartlarına bakmaz. `tek` doğruysa kartı atmadan önce `el.tek(koltuk)` çağrılmalıdır. Vale için `color` döner.

| Seviye | Nasıl oynar |
| --- | --- |
| `kolay` | Rastgele bir kart atar; TEK demeyi bazen unutur |
| `normal` | Pahalı kartlardan kurtulur, Vale'yi saklar, rengi elindeki en çok renge çevirir |
| `zor` | Normal gibi oynar; ayrıca rakiplerin kalan kart sayısına bakıp bitmek üzere olana 7, 8 ve As ile saldırır |

## Rastgelelik

Kartlar varsayılan olarak `Math.random` ile karıştırılır. Tahmin edilemeyen bir dağıtım gerekiyorsa (örneğin çevrim içi oyunda) kendi üretecinizi `rng` olarak verin: `new PisYediliHand({ players: 3, rng })`. `rng`, 0 ile 1 arasında sayı döndüren bir fonksiyondur; testlerde sabit tohumlu bir üreteç verilebilir.

## Testler

```bash
npm test
```

## Lisans

MIT. Skynon Labs Ltd. [pisyedili98](https://skynonlabs.com/browser-extensions/pisyedili98/) eklentisinin motorudur.
