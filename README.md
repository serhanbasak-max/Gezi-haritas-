# Gezi Haritası

Sero & Gorki'nin gezi haritası. Statik site (GitHub Pages) + Supabase (veritabanı, fotoğraflar, giriş).

- Herkes linkle görüntüler; yalnızca `private.editors` tablosundaki hesap düzenler.
- `data/world.json`: world-atlas 50m + ISO alfa-2 kodları.
- `vendor/`: d3 7.9.0, topojson-client 3.1.0, supabase-js 2.45.4.
- Tasarım (v4): dönen 3B dünya (d3 orthographic, world-atlas 110m), bayrak dolgulu ülkeler (flag-icons, MIT), İstanbul'dan uçuş yayları, gezi hikâyesi ekranı ve "Oynat" modu.
