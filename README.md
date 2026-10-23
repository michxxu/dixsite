# Opowieści obrazów

Internetowa gra skojarzeń dla 3–6 graczy. Gospodarz tworzy pokój, wysyła wygenerowany link, a gracze dołączają z własnych urządzeń.

## Prototyp

- W każdej rundzie jedna osoba wybiera kartę i wpisuje skojarzenie.
- Pozostali gracze dokładają własne karty, a potem głosują na kartę opowiadającego.
- Punkty naliczane są po głosowaniu; partia kończy się przy 30 punktach.
- Połączenie między przeglądarkami korzysta z PeerJS i WebRTC. Gospodarz musi mieć otwartą kartę przeglądarki przez całą partię.

## Uruchomienie i linki

Pliki `index.html`, `online.js` i `styles.css` tworzą stronę statyczną. Lokalne otwarcie `index.html` pozwala obejrzeć ekran, ale nie wygeneruje działającego zaproszenia. Do gry ze znajomymi strona musi być dostępna pod publicznym adresem HTTPS.

Można ją opublikować bezpłatnie jako publiczną stronę GitHub Pages: umieść pliki w publicznym repozytorium GitHub, a następnie w repozytorium włącz **Settings → Pages** i publikowanie z gałęzi `main`, katalogu `/ (root)`. Po publikacji otwórz adres strony, utwórz pokój i skopiuj zaproszenie.

Link do `start-game.bat` w oknie czatu pokazuje zawartość pliku. Dwuklik uruchamia go dopiero w Eksploratorze plików Windows.

Ilustracje kart są abstrakcyjnymi motywami generowanymi w CSS; projekt nie korzysta z talii ani grafik z oryginalnej gry.
