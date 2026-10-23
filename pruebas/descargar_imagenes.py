"""Descarga las fotos de producto de los pedidos de prueba desde Wikimedia Commons.

Solo usa archivos con licencia libre (dominio público, CC0, CC BY, CC BY-SA).
Guarda la miniatura de Commons más cercana a 800 px (960 px) en pruebas/imagenes/ (no se versiona) y
reescribe pruebas/FUENTES.md con la atribución de cada imagen. También genera
el comprobante de pago simulado que usa reportar_pago (requiere Pillow).

Uso:  python -I pruebas/descargar_imagenes.py
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
AGENTE = {'User-Agent': 'EncargaloSemillaPruebas/1.0 (gonfrecss2003@gmail.com)'}
CARPETA = Path(__file__).resolve().parent
DESTINO = CARPETA / 'imagenes'
LICENCIAS_LIBRES = ('public domain', 'cc0', 'cc by')  # cc by incluye cc by-sa

# nombre local (sin extensión) -> archivo en Commons
IMAGENES = {
    'switch-oled': 'File:Nintendo Switch OLED.png',
    'airpods-pro': 'File:AirPods Pro (2nd generation).jpg',
    'lego-halcon': 'File:Millennium Falcon in LEGO.jpg',
    'kobo-clara': 'File:Kobo Clara Colour.jpg',
    'adidas-ultraboost': 'File:Adidas Ultra Boost 4 running shoes.jpeg',
    'perfume-chanel': 'File:CHANEL No5 parfum.jpg',
    'garmin-forerunner': 'File:Garmin Forerunner 965.jpeg',
    'instax-mini': 'File:Fujifilm Instax Mini 25 Camera Front.jpg',
    'dualsense': 'File:DualSense Wireless Controller Cobalt Blue.jpg',
    'proteina-whey': 'File:Optimus nutrition gold standard whey protein (2).jpg',
}


def pedir(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=AGENTE), timeout=60)


def sin_html(texto):
    return re.sub(r'\s+', ' ', re.sub('<[^>]+>', '', texto or '')).strip()


def main():
    DESTINO.mkdir(exist_ok=True)
    consulta = urllib.parse.urlencode({
        'action': 'query', 'format': 'json', 'titles': '|'.join(IMAGENES.values()),
        'prop': 'imageinfo', 'iiprop': 'url|extmetadata|mime', 'iiurlwidth': 800,
    })
    datos = json.load(pedir('https://commons.wikimedia.org/w/api.php?' + consulta))
    por_titulo = {p['title']: p for p in datos['query']['pages'].values()}
    for n in datos['query'].get('normalized', []):
        por_titulo[n['from']] = por_titulo[n['to']]

    filas = []
    for local, titulo in IMAGENES.items():
        info = por_titulo[titulo]['imageinfo'][0]
        meta = info['extmetadata']
        licencia = sin_html(meta.get('LicenseShortName', {}).get('value'))
        if not licencia.lower().startswith(LICENCIAS_LIBRES):
            raise SystemExit(f'{titulo}: licencia no libre ({licencia})')
        miniatura = info.get('thumburl') or info['url']
        extension = Path(urllib.parse.urlparse(miniatura).path).suffix.lower()
        archivo = DESTINO / f'{local}{extension}'
        if not archivo.exists():
            archivo.write_bytes(pedir(miniatura).read())
        filas.append({
            'archivo': archivo.name,
            'commons': info['descriptionurl'],
            'miniatura': miniatura,
            'autor': sin_html(meta.get('Artist', {}).get('value')) or 'Desconocido',
            'licencia': licencia,
            'url_licencia': meta.get('LicenseUrl', {}).get('value', ''),
        })
        print('ok', archivo.name, licencia)

    lineas = [
        '# Fuentes de las imágenes de prueba',
        '',
        'Fotos de referencia de los pedidos de prueba que crea `sembrar.mjs`.',
        'Todas vienen de Wikimedia Commons con licencia libre; se usa una miniatura',
        'de 960 px de ancho (o la original si es menor), sin modificar. Los archivos se descargan con',
        '`python -I pruebas/descargar_imagenes.py` y no se versionan (`pruebas/imagenes/`).',
        '',
        '| Archivo | Original | Autor | Licencia |',
        '|---|---|---|---|',
    ]
    for f in filas:
        licencia = f"[{f['licencia']}]({f['url_licencia']})" if f['url_licencia'] else f['licencia']
        autor = f['autor'].replace('|', '/')
        lineas.append(f"| `{f['archivo']}` | <{f['commons']}> | {autor} | {licencia} |")
    lineas += [
        '',
        '`comprobante-prueba.png` no viene de ningún banco: lo dibuja este mismo script',
        '(Pillow) y lleva escrito «COMPROBANTE DE PRUEBA · No es un pago real».',
    ]
    (CARPETA / 'FUENTES.md').write_text('\n'.join(lineas) + '\n', encoding='utf-8')
    (CARPETA / 'fuentes.json').write_text(json.dumps(filas, ensure_ascii=False, indent=2), encoding='utf-8')


def generar_comprobante():
    """Imagen del «comprobante» que adjunta reportar_pago. Es inventada y lo dice."""
    from PIL import Image, ImageDraw
    archivo = DESTINO / 'comprobante-prueba.png'
    lienzo = Image.new('RGB', (600, 800), 'white')
    dibujo = ImageDraw.Draw(lienzo)
    dibujo.rectangle((0, 0, 600, 120), fill=(116, 47, 140))
    dibujo.text((30, 45), 'COMPROBANTE DE PRUEBA', fill='white', font_size=36)
    lineas = ['No es un pago real.', 'Generado para datos de prueba', 'de Encárgalo (MVP).',
              '', 'Método: Yape (simulado)', 'Sin valor contable.']
    for i, texto in enumerate(lineas):
        dibujo.text((30, 180 + i * 50), texto, fill=(40, 40, 40), font_size=28)
    lienzo.save(archivo)
    print('ok', archivo.name, '(generado)')


if __name__ == '__main__':
    main()
    generar_comprobante()
