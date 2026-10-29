# fakturownia-backup

[![build](https://img.shields.io/github/actions/workflow/status/MrBartusek/fakturownia-backup/ci.yml?branch=main)](https://github.com/MrBartusek/fakturownia-backup/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/MrBartusek/fakturownia-backup)](https://github.com/MrBartusek/fakturownia-backup/releases)

**fakturownia-backup** to narzędzie do pobierania faktur zapisanych w serwisie [fakturownia.pl](https://fakturownia.pl). Przydaje się, gdy potrzebujesz zrobić kopię zapasową faktur na lokalnym serwerze.

Na ten moment obsługujemy tylko pobieranie faktur na dysk lokalny. Jeśli chcesz wysyłać je do usługi chmurowej, zalecamy użycie [rclone](https://rclone.org/).

## Jak stworzyć plik konfiguracyjny

[Przykładowy plik konfiguracyjny](https://github.com/MrBartusek/fakturownia-backup/blob/main/conf.example.yml)

## Jak uruchomić obraz Docker

```sh
mkdir fakturownia-backup && cd fakturownia-backup
mkdir fakturownia
wget https://raw.githubusercontent.com/MrBartusek/fakturownia-backup/main/compose.yaml
nano conf.yml # Tutaj utwórz swoją konfigurację
docker compose up -d
```

## Jak sprawdzić wszystkie faktury

Normalnie program sprawdza i pobiera tylko te faktury, które zmieniły się w Fakturowni. Jeśli wolisz uruchomić pełny skan, użyj parametru `--full` (przy dużej ilości faktur może to chwilę zająć):

```sh
docker compose run --rm fakturownia-backup --full
```

## Pytania?

Jeśli coś jest niejasne albo masz pomysł na rozwój projektu, [otwórz issue](https://github.com/MrBartusek/fakturownia-backup/issues). Pull requesty są mile widziane!

## Licencja

Program jest darmowy i udostępniony na [licencji MIT](https://github.com/MrBartusek/fakturownia-backup/blob/main/LICENSE), bez żadnej gwarancji. Autor nie odpowiada za brakujące lub usunięte pliki ani za skutki innych błędów oprogramowania. Obowiązek przechowywania faktur wynikający z ustawy o VAT nadal spoczywa na Twojej firmie.

Projekt fakturownia-backup nie jest powiązany z Fakturownia sp. z o.o. ani przez nią wspierany.
