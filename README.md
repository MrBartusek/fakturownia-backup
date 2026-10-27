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

## Pytania?

Jeśli coś jest niejasne albo masz pomysł na rozwój projektu, [otwórz issue](https://github.com/MrBartusek/fakturownia-backup/issues). Pull requesty są mile widziane!
